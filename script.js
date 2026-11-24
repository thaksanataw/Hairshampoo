/* ==========================================================
   Hair Shampoo — shared script (product / order / admin)
   Each section runs only if its elements exist on the page.
   ========================================================== */

var ORDER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxFTtcKH79KgzL-Seq1TfKozE97oHPYKaSSpFC9D9fGipg-pjcFbB_7OC3OD-Qe_avW/exec';
var ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvQy992ZKT6XLiPlS_hwhePKKixSjrpGzALU7w14SSY3oaOSwxDC6zthOHyM6OvtaVJZBOgwx2ZoHg/pub?gid=0&single=true&output=csv';

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('product-list')) initProductPage();
  if (document.getElementById('orderForm')) initOrderPage();
  if (document.querySelector('#ordersTable tbody')) initAdminPage();
});

/* ---------- Helpers ---------- */

// "Kaffir Lime" / "kaffir-lime" / "kiffirlime" -> "kaffirlime"
function normalizeMood(value) {
  var key = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  var aliases = {
    kiffirlime: 'kaffirlime',
    kaffir: 'kaffirlime',
    kiffir: 'kaffirlime',
    butterfly: 'butterflypea'
  };
  return aliases[key] || key;
}

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

/* ==========================================================
   1) product.html
   ========================================================== */

function initProductPage() {
  var list = document.getElementById('product-list');
  var filterBar = document.getElementById('filter-bar');
  var products = [];
  var currentMood = 'all';

  var filters = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'kaffirlime', label: 'Kaffir Lime' },
    { key: 'butterflypea', label: 'Butterfly Pea' }
  ];

  function buildFilterBar() {
    if (!filterBar) return;
    filterBar.innerHTML = '';
    filters.forEach(function (f) {
      var btn = el('button', 'btn filter-btn', f.label);
      btn.type = 'button';
      btn.dataset.mood = f.key;
      btn.addEventListener('click', function () {
        currentMood = f.key;
        render();
      });
      filterBar.appendChild(btn);
    });
  }

  function createCard(p) {
    var moodKey = normalizeMood(p.mood);
    var card = el('article', 'product-card ' + (moodKey === 'kaffirlime' ? 'mood-kaffir-lime' : 'mood-butterfly-pea'));

    var imgWrap = el('div', 'product-card__image');
    var img = el('img');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    imgWrap.appendChild(img);

    var body = el('div', 'product-card__body');
    body.appendChild(el('span', 'mood-tag', p.mood));
    body.appendChild(el('h3', 'product-card__name', p.name));

    var meta = el('div', 'product-card__meta');
    meta.appendChild(el('span', 'product-card__size', p.size || ''));
    meta.appendChild(el('span', 'price', Number(p.price).toLocaleString('th-TH')));
    body.appendChild(meta);

    // item = name + size (size may be null for conditioner)
    var itemLabel = p.size ? p.name + ' ' + p.size : p.name;
    var params = new URLSearchParams({ item: itemLabel, price: p.price });
    var order = el('a', 'btn btn--accent btn--block', 'สั่งซื้อ');
    order.href = 'order.html?' + params.toString();
    body.appendChild(order);

    card.appendChild(imgWrap);
    card.appendChild(body);
    return card;
  }

  function render() {
    list.innerHTML = '';

    var shown = products.filter(function (p) {
      return currentMood === 'all' || normalizeMood(p.mood) === currentMood;
    });

    if (shown.length === 0) {
      list.appendChild(el('p', 'muted', 'ไม่พบสินค้าในหมวดนี้'));
    } else {
      shown.forEach(function (p) { list.appendChild(createCard(p)); });
    }

    if (filterBar) {
      filterBar.querySelectorAll('.filter-btn').forEach(function (btn) {
        var active = btn.dataset.mood === currentMood;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  buildFilterBar();

  // Auto-filter from ?mood=xxx (falls back to "all" if unknown)
  var moodParam = normalizeMood(new URLSearchParams(window.location.search).get('mood'));
  if (moodParam === 'kaffirlime' || moodParam === 'butterflypea') currentMood = moodParam;

  fetch('products.json')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      render();
    })
    .catch(function (error) {
      console.error(error);
      list.innerHTML = '';
      list.appendChild(el('p', 'form-message form-message--error', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง'));
    });
}

/* ==========================================================
   2) order.html
   ========================================================== */

function initOrderPage() {
  var form = document.getElementById('orderForm');
  var itemsInput = document.getElementById('items');
  var totalInput = document.getElementById('total');

  // Prefill items + total from URL parameters
  var params = new URLSearchParams(window.location.search);
  var item = params.get('item');
  var price = params.get('price');
  if (item !== null) itemsInput.value = item;
  if (price !== null) totalInput.value = price;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

    var rawTotal = totalInput.value.trim();
    var payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: itemsInput.value.trim(),
      total: rawTotal !== '' && !isNaN(Number(rawTotal)) ? Number(rawTotal) : rawTotal,
      note: document.getElementById('note').value.trim()
    };

    if (!payload.customerName || !payload.contact || !payload.items || payload.total === '') {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================
   3) admin.html
   ========================================================== */

// Minimal CSV parser: quoted fields, "" escapes, commas/newlines inside quotes
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM

  for (var i = 0; i < text.length; i++) {
    var ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(function (r) {
    return r.some(function (cell) { return cell.trim() !== ''; });
  });
}

function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');
  var COLUMNS = 6; // date, name, contact, items, total, note

  function showMessage(text, isError) {
    tbody.innerHTML = '';
    var tr = document.createElement('tr');
    var td = el('td', isError ? 'form-message--error' : 'muted', text);
    td.colSpan = COLUMNS;
    td.style.textAlign = 'center';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...', false);

  // Timestamp param avoids stale browser cache
  fetch(ORDERS_CSV_URL + '&t=' + Date.now())
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);

      // Skip a header row if present (first cell has no digits, e.g. "วันเวลา")
      if (rows.length > 0 && !/\d/.test(rows[0][0] || '')) rows.shift();

      if (rows.length === 0) {
        showMessage('ยังไม่มีรายการสั่งซื้อ', false);
        return;
      }

      // Rows are appended chronologically, so reversing = newest first
      rows.reverse();

      tbody.innerHTML = '';
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        for (var i = 0; i < COLUMNS; i++) {
          tr.appendChild(el('td', '', r[i] !== undefined ? r[i] : ''));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (error) {
      console.error(error);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้านี้อีกครั้ง', true);
    });
}

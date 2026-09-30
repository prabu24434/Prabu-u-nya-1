/* ==========================================================
   admin/script.js
   Panel admin untuk kelola menu (gorengan, paket serundeng,
   opsi nasi & telur). Data disimpan di file menu.json pada
   Gist yang SAMA dengan yang dipakai web kasir (lewat proxy
   /api/gist, sama seperti punya web kasir — lihat DEPLOY.md).
   Web kasir akan otomatis memakai data ini karena kasir juga
   membaca menu.json (lihat applyMenuData() di script-part1.js).
   ========================================================== */

/* ---------- Data default (dipakai kalau menu.json belum ada) ---------- */

const DEFAULT_MENU_GORENGAN = [
  { id: 'g1',  name: 'Donat Ubi Ungu',     unit: '3 pcs', price: 6000 },
  { id: 'g2',  name: 'Donat Kentang',      unit: '3 pcs', price: 6000 },
  { id: 'g3',  name: 'Nangka Goreng',      unit: '3 pcs', price: 5000 },
  { id: 'g4',  name: 'Roti Goreng Coklat', unit: '4 pcs', price: 5000 },
  { id: 'g5',  name: 'Gemblong Mini',      unit: '4 pcs', price: 5000 },
  { id: 'g6',  name: 'Pisang Goreng',      unit: '4 pcs', price: 5000 },
  { id: 'g7',  name: 'Tape Goreng',        unit: '4 pcs', price: 5000 },
  { id: 'g8',  name: 'Tahu Goreng',        unit: '4 pcs', price: 5000 },
  { id: 'g9',  name: 'Bakwan Goreng',      unit: '4 pcs', price: 5000 },
  { id: 'g10', name: 'Bakwan Tempe',       unit: '4 pcs', price: 5000 },
];

const DEFAULT_MENU_SERUNDENG = [
  { id: 's1', name: 'Ayam Sayap',         price: 13000, requiresRice: true, hasEggType: false },
  { id: 's2', name: 'Hati Ampela',        price: 11000, requiresRice: true, hasEggType: false },
  { id: 's3', name: 'Kepala Ayam Jumbo',  price: 11000, requiresRice: true, hasEggType: false },
  { id: 's4', name: 'Telur',              price: 11000, requiresRice: true, hasEggType: true  },
  { id: 's5', name: 'Lele',               price: 13000, requiresRice: true, hasEggType: false },
];

const DEFAULT_RICE_OPTIONS = ['Nasi Putih', 'Nasi Tutug Oncom', 'Nasi Daun Jeruk'];
const DEFAULT_EGG_OPTIONS = ['Dadar', 'Ceplok'];

/* ---------- State ---------- */

const state = {
  gorengan: [],
  serundeng: [],
  riceOptions: [],
  eggOptions: [],
  modalCategory: null,  // 'gorengan' | 'serundeng'
  modalEditId: null,    // null = tambah baru
};

/* ---------- Util ---------- */

function formatRupiah(amount) {
  const rounded = Math.round(amount || 0);
  return 'Rp' + rounded.toLocaleString('id-ID');
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000);
}

function showToast(message) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toastEl.classList.remove('show'), 2400);
}

function setDbStatus(kind, text) {
  const dot = document.getElementById('dbStatusDot');
  const label = document.getElementById('dbStatusText');
  if (!dot || !label) return;
  dot.className = 'db-status-dot ' + kind;
  label.textContent = text;
}

/* ---------- GistDB client (sama seperti di web kasir) ---------- */

const GistDB = {
  async readFile(filename) {
    const res = await fetch(`/api/gist?file=${encodeURIComponent(filename)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.value;
  },
  async writeFile(filename, value) {
    const res = await fetch('/api/gist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: filename, content: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
};

/* ---------- Load & Save ---------- */

async function loadMenu() {
  setDbStatus('syncing', 'Memuat...');
  try {
    const menuData = await GistDB.readFile('menu.json');
    if (menuData && typeof menuData === 'object') {
      state.gorengan = Array.isArray(menuData.gorengan) ? menuData.gorengan : [];
      state.serundeng = Array.isArray(menuData.serundeng) ? menuData.serundeng : [];
      state.riceOptions = Array.isArray(menuData.riceOptions) ? menuData.riceOptions : [];
      state.eggOptions = Array.isArray(menuData.eggOptions) ? menuData.eggOptions : [];
    } else {
      // Belum pernah diisi -> mulai dari menu default punya kasir,
      // langsung simpan supaya kasir & admin sama-sama sinkron.
      state.gorengan = DEFAULT_MENU_GORENGAN.map((item) => ({ ...item }));
      state.serundeng = DEFAULT_MENU_SERUNDENG.map((item) => ({ ...item }));
      state.riceOptions = [...DEFAULT_RICE_OPTIONS];
      state.eggOptions = [...DEFAULT_EGG_OPTIONS];
      await saveMenu({ silent: true });
    }
    setDbStatus('online', 'Tersambung');
    renderAll();
  } catch (err) {
    console.error('Gagal memuat menu:', err);
    setDbStatus('error', 'Gagal tersambung');
    showToast('Gagal memuat menu: ' + err.message);
  }
}

async function saveMenu(opts = {}) {
  setDbStatus('syncing', 'Menyimpan...');
  try {
    await GistDB.writeFile('menu.json', {
      gorengan: state.gorengan,
      serundeng: state.serundeng,
      riceOptions: state.riceOptions,
      eggOptions: state.eggOptions,
    });
    setDbStatus('online', 'Tersambung');
    if (!opts.silent) showToast('Perubahan tersimpan');
  } catch (err) {
    console.error('Gagal menyimpan menu:', err);
    setDbStatus('error', 'Gagal menyimpan');
    showToast('Gagal menyimpan ke database: ' + err.message);
    throw err;
  }
}

/* ---------- Render: tabel Semua Menu (gabungan) ---------- */

function renderSemua() {
  const tbody = document.querySelector('#tableSemua tbody');
  const emptyHint = document.getElementById('emptySemua');
  const countEl = document.getElementById('totalMenuCount');
  tbody.innerHTML = '';

  const combined = [
    ...state.gorengan.map((item) => ({ ...item, __cat: 'gorengan', __label: 'Gorengan' })),
    ...state.serundeng.map((item) => ({ ...item, __cat: 'serundeng', __label: 'Serundeng' })),
  ];

  countEl.textContent = `${combined.length} menu`;

  if (combined.length === 0) {
    emptyHint.hidden = false;
    return;
  }
  emptyHint.hidden = true;

  combined.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="type-badge ${item.__cat}">${item.__label}</span></td>
      <td class="item-name">${escapeHtml(item.name)}</td>
      <td>${formatRupiah(item.price)}</td>
      <td>
        <div class="item-actions">
          <button class="icon-btn" data-action="edit" data-cat="${item.__cat}" data-id="${item.id}" aria-label="Edit">✎</button>
          <button class="icon-btn danger" data-action="delete" data-cat="${item.__cat}" data-id="${item.id}" aria-label="Hapus">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Render: tabel Gorengan ---------- */

function renderGorengan() {
  const tbody = document.querySelector('#tableGorengan tbody');
  const emptyHint = document.getElementById('emptyGorengan');
  tbody.innerHTML = '';

  if (state.gorengan.length === 0) {
    emptyHint.hidden = false;
    return;
  }
  emptyHint.hidden = true;

  state.gorengan.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="reorder-col">
          <button class="icon-btn" data-action="up" data-cat="gorengan" data-id="${item.id}" ${idx === 0 ? 'disabled' : ''} aria-label="Naikkan">▲</button>
          <button class="icon-btn" data-action="down" data-cat="gorengan" data-id="${item.id}" ${idx === state.gorengan.length - 1 ? 'disabled' : ''} aria-label="Turunkan">▼</button>
        </div>
      </td>
      <td class="item-name">${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.unit || '-')}</td>
      <td>${formatRupiah(item.price)}</td>
      <td>
        <div class="item-actions">
          <button class="icon-btn" data-action="edit" data-cat="gorengan" data-id="${item.id}" aria-label="Edit">✎</button>
          <button class="icon-btn danger" data-action="delete" data-cat="gorengan" data-id="${item.id}" aria-label="Hapus">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Render: tabel Serundeng ---------- */

function renderSerundeng() {
  const tbody = document.querySelector('#tableSerundeng tbody');
  const emptyHint = document.getElementById('emptySerundeng');
  tbody.innerHTML = '';

  if (state.serundeng.length === 0) {
    emptyHint.hidden = false;
    return;
  }
  emptyHint.hidden = true;

  state.serundeng.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="reorder-col">
          <button class="icon-btn" data-action="up" data-cat="serundeng" data-id="${item.id}" ${idx === 0 ? 'disabled' : ''} aria-label="Naikkan">▲</button>
          <button class="icon-btn" data-action="down" data-cat="serundeng" data-id="${item.id}" ${idx === state.serundeng.length - 1 ? 'disabled' : ''} aria-label="Turunkan">▼</button>
        </div>
      </td>
      <td class="item-name">${escapeHtml(item.name)}</td>
      <td>${formatRupiah(item.price)}</td>
      <td>${item.requiresRice ? '<span class="badge-yes">Ya</span>' : '<span class="badge-no">Tidak</span>'}</td>
      <td>${item.hasEggType ? '<span class="badge-yes">Ya</span>' : '<span class="badge-no">Tidak</span>'}</td>
      <td>
        <div class="item-actions">
          <button class="icon-btn" data-action="edit" data-cat="serundeng" data-id="${item.id}" aria-label="Edit">✎</button>
          <button class="icon-btn danger" data-action="delete" data-cat="serundeng" data-id="${item.id}" aria-label="Hapus">🗑</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Render: chip opsi nasi & telur ---------- */

function renderChipList(listId, options, kind) {
  const container = document.getElementById(listId);
  container.innerHTML = '';
  options.forEach((opt, idx) => {
    const chip = document.createElement('span');
    chip.className = 'opt-chip';
    chip.innerHTML = `${escapeHtml(opt)} <button type="button" data-kind="${kind}" data-idx="${idx}" aria-label="Hapus">&times;</button>`;
    container.appendChild(chip);
  });
}

function renderOptions() {
  renderChipList('riceChipList', state.riceOptions, 'rice');
  renderChipList('eggChipList', state.eggOptions, 'egg');
}

function renderAll() {
  renderSemua();
  renderGorengan();
  renderSerundeng();
  renderOptions();
}

/* ---------- Modal tambah/edit item menu ---------- */

function openItemModal(category, item) {
  state.modalCategory = category;
  state.modalEditId = item ? item.id : null;

  document.getElementById('itemModalError').hidden = true;
  document.getElementById('itemModalTitle').textContent =
    (item ? 'Edit ' : 'Tambah ') + (category === 'gorengan' ? 'Menu Gorengan' : 'Paket Serundeng');

  document.getElementById('fieldName').value = item ? item.name : '';
  document.getElementById('fieldPrice').value = item ? item.price : '';
  document.getElementById('fieldUnit').value = item && item.unit ? item.unit : '';
  document.getElementById('fieldRequiresRice').checked = item ? !!item.requiresRice : true;
  document.getElementById('fieldHasEgg').checked = item ? !!item.hasEggType : false;

  document.getElementById('fieldUnitWrap').hidden = category !== 'gorengan';
  document.getElementById('fieldRiceWrap').hidden = category !== 'serundeng';
  document.getElementById('fieldEggWrap').hidden = category !== 'serundeng';

  document.getElementById('itemModalOverlay').classList.add('open');
  document.getElementById('fieldName').focus();
}

function closeItemModal() {
  document.getElementById('itemModalOverlay').classList.remove('open');
}

async function handleModalSave() {
  const name = document.getElementById('fieldName').value.trim();
  const priceRaw = document.getElementById('fieldPrice').value;
  const price = Number(priceRaw);
  const errorEl = document.getElementById('itemModalError');

  if (!name) {
    errorEl.textContent = 'Nama menu wajib diisi.';
    errorEl.hidden = false;
    return;
  }
  if (!priceRaw || isNaN(price) || price <= 0) {
    errorEl.textContent = 'Harga wajib diisi dan harus lebih dari 0.';
    errorEl.hidden = false;
    return;
  }

  const category = state.modalCategory;
  const list = category === 'gorengan' ? state.gorengan : state.serundeng;

  let itemData;
  if (category === 'gorengan') {
    itemData = { name, unit: document.getElementById('fieldUnit').value.trim(), price };
  } else {
    itemData = {
      name,
      price,
      requiresRice: document.getElementById('fieldRequiresRice').checked,
      hasEggType: document.getElementById('fieldHasEgg').checked,
    };
  }

  if (state.modalEditId) {
    const idx = list.findIndex((it) => it.id === state.modalEditId);
    if (idx !== -1) list[idx] = { ...list[idx], ...itemData };
  } else {
    itemData.id = generateId(category === 'gorengan' ? 'g' : 's');
    list.push(itemData);
  }

  renderAll();
  closeItemModal();
  try {
    await saveMenu();
  } catch (err) {
    // toast sudah ditampilkan oleh saveMenu()
  }
}

/* ---------- Delete & reorder ---------- */

async function deleteItem(category, id) {
  const list = category === 'gorengan' ? state.gorengan : state.serundeng;
  const item = list.find((it) => it.id === id);
  if (!item) return;
  const confirmed = window.confirm(`Hapus "${item.name}" dari menu?`);
  if (!confirmed) return;

  const idx = list.findIndex((it) => it.id === id);
  list.splice(idx, 1);
  renderAll();
  try {
    await saveMenu();
  } catch (err) {
    // toast sudah ditampilkan
  }
}

async function moveItem(category, id, direction) {
  const list = category === 'gorengan' ? state.gorengan : state.serundeng;
  const idx = list.findIndex((it) => it.id === id);
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx === -1 || targetIdx < 0 || targetIdx >= list.length) return;

  [list[idx], list[targetIdx]] = [list[targetIdx], list[idx]];
  renderAll();
  try {
    await saveMenu({ silent: true });
  } catch (err) {
    // toast sudah ditampilkan
  }
}

/* ---------- Opsi nasi & telur: tambah/hapus ---------- */

async function addOption(kind) {
  const inputId = kind === 'rice' ? 'newRiceInput' : 'newEggInput';
  const input = document.getElementById(inputId);
  const value = input.value.trim();
  if (!value) return;

  const list = kind === 'rice' ? state.riceOptions : state.eggOptions;
  if (list.some((v) => v.toLowerCase() === value.toLowerCase())) {
    showToast('Opsi itu sudah ada.');
    return;
  }
  list.push(value);
  input.value = '';
  renderOptions();
  try {
    await saveMenu({ silent: true });
    showToast('Opsi ditambahkan');
  } catch (err) {
    // toast sudah ditampilkan
  }
}

async function removeOption(kind, idx) {
  const list = kind === 'rice' ? state.riceOptions : state.eggOptions;
  list.splice(idx, 1);
  renderOptions();
  try {
    await saveMenu({ silent: true });
  } catch (err) {
    // toast sudah ditampilkan
  }
}

/* ---------- Init & event listeners ---------- */

function initApp() {
  document.getElementById('btnBackToKasir').addEventListener('click', (e) => {
    e.preventDefault();
    window.location.replace('/');
  });

  document.getElementById('btnAddGorengan').addEventListener('click', () => openItemModal('gorengan', null));
  document.getElementById('btnAddSerundeng').addEventListener('click', () => openItemModal('serundeng', null));

  document.getElementById('itemModalClose').addEventListener('click', closeItemModal);
  document.getElementById('itemModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'itemModalOverlay') closeItemModal();
  });
  document.getElementById('itemModalSave').addEventListener('click', handleModalSave);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeItemModal();
  });

  // Delegasi klik untuk tombol edit/hapus/naik/turun di kedua tabel
  document.querySelector('main.layout').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, cat, id } = btn.dataset;
    const list = cat === 'gorengan' ? state.gorengan : state.serundeng;

    if (action === 'edit') {
      const item = list.find((it) => it.id === id);
      openItemModal(cat, item);
    } else if (action === 'delete') {
      deleteItem(cat, id);
    } else if (action === 'up') {
      moveItem(cat, id, 'up');
    } else if (action === 'down') {
      moveItem(cat, id, 'down');
    }
  });

  // Opsi nasi & telur
  document.getElementById('btnAddRice').addEventListener('click', () => addOption('rice'));
  document.getElementById('btnAddEgg').addEventListener('click', () => addOption('egg'));
  document.getElementById('newRiceInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addOption('rice');
  });
  document.getElementById('newEggInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addOption('egg');
  });
  document.getElementById('riceChipList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (!btn) return;
    removeOption(btn.dataset.kind, Number(btn.dataset.idx));
  });
  document.getElementById('eggChipList').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (!btn) return;
    removeOption(btn.dataset.kind, Number(btn.dataset.idx));
  });

  loadMenu();
}

document.addEventListener('DOMContentLoaded', initApp);

/* ==========================================================
   script-part1.js
   Data menu, state global, dan fungsi utilitas (helper).
   ========================================================== */

/* ---------- DATA MENU ---------- */

/* Data di bawah ini adalah FALLBACK/DEFAULT — dipakai saat pertama kali
   dibuka sebelum data dari database (Gist, file menu.json) selesai
   dimuat, atau kalau menu.json belum pernah dibuat sama sekali.
   Begitu database berhasil disambungkan, isi MENU_GORENGAN / MENU_SERUNDENG
   / RICE_OPTIONS / EGG_OPTIONS di bawah akan ditimpa oleh applyMenuData()
   (dipanggil dari loadInitialDataFromGitHub, lihat bawah file ini).
   Menu sekarang dikelola lewat web admin terpisah (folder /admin),
   BUKAN dengan mengedit array ini langsung. */

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

let MENU_GORENGAN = DEFAULT_MENU_GORENGAN.map((item) => ({ ...item }));
let MENU_SERUNDENG = DEFAULT_MENU_SERUNDENG.map((item) => ({ ...item }));
let RICE_OPTIONS = [...DEFAULT_RICE_OPTIONS];
let EGG_OPTIONS = [...DEFAULT_EGG_OPTIONS];

/**
 * Timpa data menu global dengan data yang diambil dari menu.json di Gist
 * (dikelola lewat web admin terpisah). Kalau salah satu bagian kosong/tidak
 * valid, bagian itu tetap memakai default supaya kasir tidak pernah tampil
 * kosong sama sekali.
 */
function applyMenuData(menuData) {
  if (!menuData || typeof menuData !== 'object') return;
  if (Array.isArray(menuData.gorengan) && menuData.gorengan.length > 0) {
    MENU_GORENGAN = menuData.gorengan;
  }
  if (Array.isArray(menuData.serundeng) && menuData.serundeng.length > 0) {
    MENU_SERUNDENG = menuData.serundeng;
  }
  if (Array.isArray(menuData.riceOptions) && menuData.riceOptions.length > 0) {
    RICE_OPTIONS = menuData.riceOptions;
  }
  if (Array.isArray(menuData.eggOptions) && menuData.eggOptions.length > 0) {
    EGG_OPTIONS = menuData.eggOptions;
  }
}

/* ---------- STATE GLOBAL ---------- */

const state = {
  customer: {
    nama: '',
    metode: 'ambil', // 'ambil' (di tempat) | 'antar' (perlu alamat)
    tujuan: 'Ambil di Tempat',
  },
  cart: [],           // isi keranjang aktif
  orders: [],         // riwayat pesanan (setelah checkout)
  searchTerm: '',
  activeCategory: 'gorengan', // 'gorengan' | 'serundeng'
  editingCartId: null,        // cartId yang sedang diedit, null jika menambah baru
  currentModalItem: null,     // menu item yang sedang dibuka di modal
  selectedEgg: null,
  selectedRice: null,
  modalQty: 1,
  paymentMethod: null,        // 'cash' | 'qris'
  cashInput: '',              // string digit uang cash yang diketik
  orderCounter: 1,
  db: {
    configured: false,   // sudah isi Gist ID + Token & tersambung minimal 1x
    syncing: false,      // sedang ada request ke GitHub berjalan
    cartDirty: false,    // keranjang berubah sejak autosave terakhir
    lastSyncAt: null,    // Date terakhir kali berhasil sync
  },
};

/* ---------- UTIL ---------- */

/** Format angka menjadi string Rupiah, mis. 15000 -> "Rp15.000" */
function formatRupiah(amount) {
  const rounded = Math.round(amount || 0);
  return 'Rp' + rounded.toLocaleString('id-ID');
}

/** Cari data menu (gorengan/serundeng) berdasarkan id */
function findMenuById(id) {
  return (
    MENU_GORENGAN.find((m) => m.id === id) ||
    MENU_SERUNDENG.find((m) => m.id === id) ||
    null
  );
}

/** Buat id unik sederhana untuk item keranjang / pesanan */
function generateId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 10000);
}

/**
 * Alias kompatibilitas: perhitungan subtotal & grand total sekarang
 * diimplementasikan di script-part2.js (calculateCartItemSubtotal /
 * calculateGrandTotal). Fungsi di sini hanya meneruskan pemanggilan
 * supaya script-part3.js yang masih memakai nama lama tetap berjalan,
 * tanpa ada dua logika perhitungan yang terpisah.
 */
function calcCartItemSubtotal(item) {
  return calculateCartItemSubtotal(item);
}

function calcGrandTotal() {
  return calculateGrandTotal();
}

/** Tampilkan notifikasi kecil (toast) di bawah layar */
function showToast(message) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toastEl.classList.remove('show');
  }, 2200);
}

/** Escape teks sederhana untuk mencegah HTML injection dari input pelanggan */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================
   LOAD DATA DARI GITHUB (database online, pengganti localStorage)
   Implementasi konkret pemanggilan API ada di GistDB, yang
   didefinisikan di script-part4.js. Fungsi di sini hanya
   mengurus "menaruh" data yang didapat ke dalam `state`.
   ========================================================== */

/**
 * Ambil seluruh data (riwayat transaksi + keranjang yang belum checkout)
 * dari GitHub Gist, lalu isi ke dalam `state`. Dipanggil sekali saat
 * halaman pertama kali tersambung ke database, dan tiap kali user
 * menekan tombol "Refresh" pada dashboard.
 */
async function loadInitialDataFromGitHub() {
  if (typeof GistDB === 'undefined' || !GistDB.ready) return;

  if (typeof setDbStatus === 'function') setDbStatus('syncing', 'Memuat data...');

  try {
    const [transactions, savedCart, menuData] = await Promise.all([
      GistDB.readFile('transactions.json'),
      GistDB.readFile('cart.json'),
      GistDB.readFile('menu.json'),
    ]);

    // Menu (gorengan/serundeng/opsi nasi/opsi telur) dikelola lewat web
    // admin terpisah (folder /admin) dan disimpan di file menu.json.
    // Kalau belum pernah diisi dari admin, kasir tetap tampil dengan
    // menu default bawaan (lihat DEFAULT_MENU_* di atas).
    applyMenuData(menuData);

    if (Array.isArray(transactions)) {
      // createdAt disimpan sebagai string ISO di Gist, kembalikan jadi Date
      state.orders = transactions.map((o) => ({ ...o, createdAt: new Date(o.createdAt) }));

      // Lanjutkan penomoran ORD-XXXX dari data yang sudah ada supaya tidak bentrok
      const maxNum = state.orders.reduce((max, o) => {
        const n = parseInt(String(o.orderId).replace('ORD-', ''), 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      state.orderCounter = maxNum + 1;
    }

    // Pulihkan keranjang yang tersimpan (misalnya browser sempat ter-refresh)
    if (savedCart && Array.isArray(savedCart.cart) && savedCart.cart.length > 0) {
      state.cart = savedCart.cart;
      state.customer = savedCart.customer || state.customer;
      if (!state.customer.metode) state.customer.metode = 'ambil'; // data lama sebelum fitur ini ada

      // Samakan tampilan form pelanggan dengan data yang baru dipulihkan
      const custNameEl = document.getElementById('custName');
      if (custNameEl) custNameEl.value = state.customer.nama || '';
      const restoredTujuan = state.customer.tujuan || '';
      if (typeof setDestMode === 'function') setDestMode(state.customer.metode);
      if (state.customer.metode === 'antar') {
        const custDestEl = document.getElementById('custDest');
        if (custDestEl) custDestEl.value = restoredTujuan;
        state.customer.tujuan = restoredTujuan;
      }

      showToast('Keranjang sebelumnya berhasil dipulihkan dari GitHub');
    }

    state.db.lastSyncAt = new Date();
    if (typeof setDbStatus === 'function') setDbStatus('online', 'Tersambung');
  } catch (err) {
    console.error('Gagal memuat data dari GitHub:', err);
    if (typeof setDbStatus === 'function') setDbStatus('error', 'Gagal memuat data');
    showToast('Gagal memuat data dari GitHub: ' + err.message);
  }
}

/** Update jam digital di header */
function updateClock() {
  const clockEl = document.getElementById('clockDisplay');
  if (!clockEl) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  clockEl.textContent = `${dateStr} • ${hh}:${mm}`;
}

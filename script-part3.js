/* ==========================================================
   script-part3.js — PART 3
   Checkout, Pembayaran (Cash + keypad / QRIS), Status Pesanan
   (Menunggu -> Selesai), Riwayat Pesanan, dan inisialisasi
   seluruh event listener aplikasi.

   Fungsi utama (sesuai spesifikasi):
     - processCheckout()      -> validasi & buka modal pembayaran
     - showPaymentModal()     -> render & tampilkan modal checkout
     - handleCashPayment()    -> aktifkan panel Cash + keypad
     - handleQRISPayment()    -> aktifkan panel QRIS
     - updateOrderStatus()    -> ubah status pesanan (Menunggu/Selesai)
     - renderOrderHistory()   -> render daftar riwayat pesanan
     - keypad: numberClick(), backspace(), clear()
   ========================================================== */

/* ==========================================================
   1. PROSES CHECKOUT -> MODAL PEMBAYARAN
   ========================================================== */

/**
 * Ganti mode tujuan antara "Ambil di Tempat" dan "Antar".
 * Kalau "Antar" dipilih, field alamat dimunculkan dan wajib diisi
 * sebelum checkout. Kalau "Ambil di Tempat", field alamat disembunyikan
 * & dikosongkan, tujuan otomatis diisi "Ambil di Tempat".
 */
function setDestMode(mode) {
  state.customer.metode = mode;
  document.querySelectorAll('.dest-toggle-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const addressField = document.getElementById('destAddressField');
  const destInput = document.getElementById('custDest');

  if (mode === 'antar') {
    addressField.hidden = false;
    state.customer.tujuan = destInput.value.trim();
    destInput.focus();
  } else {
    addressField.hidden = true;
    destInput.value = '';
    state.customer.tujuan = 'Ambil di Tempat';
  }
  markCartDirty();
}

/* ==========================================================
   JALUR RAHASIA KE MENU ADMIN
   Dipicu dengan memencet logo di pojok kiri atas. Teks di modal
   sengaja bilang "minimal 3 angka" sebagai pengecoh — kode ASLINYA
   cuma satu digit: "0". Siapa pun yang ikut instruksi mentah-mentah
   (ngetik 3 digit, misal "000") justru akan ditolak.
   ========================================================== */

function openSecretCodeModal() {
  document.getElementById('secretCodeError').hidden = true;
  document.getElementById('secretCodeInput').value = '';
  document.getElementById('secretCodeModalOverlay').classList.add('open');
  document.getElementById('secretCodeInput').focus();
}

function closeSecretCodeModal() {
  document.getElementById('secretCodeModalOverlay').classList.remove('open');
}

/** Valid HANYA kalau kodenya persis satu karakter "0". Teks "minimal 3
 * angka" di modal sengaja jadi pengecoh — orang yang ikut instruksi itu
 * mentah-mentah (misal ngetik "000") justru akan DITOLAK. Kode aslinya
 * cuma satu digit angka 0. */
function isValidSecretCode(code) {
  return code === '0';
}

function submitSecretCode() {
  const input = document.getElementById('secretCodeInput');
  const code = input.value.trim();

  if (isValidSecretCode(code)) {
    window.location.replace('/admin');
    return;
  }

  document.getElementById('secretCodeError').hidden = false;
  const modalBox = document.querySelector('#secretCodeModalOverlay .modal');
  modalBox.classList.remove('shake');
  void modalBox.offsetWidth; // trik supaya animasi bisa diulang
  modalBox.classList.add('shake');
  input.value = '';
  input.focus();
}

/**
 * Dipanggil saat tombol "Checkout" di keranjang ditekan.
 * Memvalidasi keranjang & data pelanggan, lalu membuka modal pembayaran.
 */
function processCheckout() {
  if (state.cart.length === 0) {
    showToast('Keranjang masih kosong');
    return;
  }
  if (!state.customer.nama.trim()) {
    showToast('Isi nama pelanggan terlebih dahulu');
    document.getElementById('custName').focus();
    return;
  }
  if (state.customer.metode === 'antar' && !state.customer.tujuan.trim()) {
    showToast('Isi alamat / lokasi antar terlebih dahulu');
    document.getElementById('custDest').focus();
    return;
  }

  state.paymentMethod = null;
  state.cashInput = '';

  showPaymentModal();
}

/**
 * Menampilkan modal pembayaran: render ringkasan pesanan & total,
 * reset UI metode pembayaran (Cash/QRIS), lalu buka overlay modal.
 */
function showPaymentModal() {
  renderCheckoutSummary();
  resetPaymentUI();
  document.getElementById('checkoutModalOverlay').classList.add('open');
}

function closeCheckoutModal() {
  document.getElementById('checkoutModalOverlay').classList.remove('open');
}

/** Render data pelanggan + daftar item + total pada modal checkout */
function renderCheckoutSummary() {
  const custEl = document.getElementById('checkoutCustomer');
  custEl.innerHTML = `
    <div><b>Nama:</b> ${escapeHtml(state.customer.nama || '-')}</div>
    <div><b>Tujuan Antar:</b> ${escapeHtml(state.customer.tujuan || '-')}</div>
  `;

  const summaryEl = document.getElementById('checkoutSummary');
  summaryEl.innerHTML = '';
  state.cart.forEach((item) => {
    const variantParts = [];
    if (item.unit) variantParts.push(item.unit);
    if (item.eggType) variantParts.push(`Telur ${item.eggType}`);
    if (item.rice) variantParts.push(item.rice);
    const variantText = variantParts.join(' • ');

    const row = document.createElement('div');
    row.className = 'checkout-summary-row';
    row.innerHTML = `
      <span class="label">${item.qty}x ${escapeHtml(item.name)}
        ${variantText ? `<span class="sub">${escapeHtml(variantText)}</span>` : ''}
      </span>
      <span class="amount">${formatRupiah(calcCartItemSubtotal(item))}</span>
    `;
    summaryEl.appendChild(row);
  });

  document.getElementById('checkoutTotal').textContent = formatRupiah(calcGrandTotal());
}

/** Kembalikan seluruh elemen modal pembayaran ke kondisi awal (belum pilih metode) */
function resetPaymentUI() {
  document.querySelectorAll('.payment-btn').forEach((btn) => btn.classList.remove('selected'));
  document.getElementById('cashPanel').hidden = true;
  document.getElementById('qrisPanel').hidden = true;
  document.getElementById('cashAmountDisplay').textContent = formatRupiah(0);
  const changeRow = document.getElementById('changeRow');
  changeRow.classList.remove('insufficient');
  document.getElementById('changeDisplay').textContent = formatRupiah(0);
  document.getElementById('btnConfirmPayment').disabled = true;
}

/**
 * Dipanggil saat user menekan salah satu tombol metode pembayaran
 * (Cash / QRIS). Meneruskan ke handleCashPayment() atau handleQRISPayment().
 */
function selectPaymentMethod(method) {
  state.paymentMethod = method;
  state.cashInput = '';

  document.querySelectorAll('.payment-btn').forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.method === method);
  });

  if (method === 'cash') {
    handleCashPayment();
  } else {
    handleQRISPayment();
  }
}

/* ==========================================================
   2. PEMBAYARAN CASH (TUNAI) + KEYPAD
   ========================================================== */

/**
 * Mengaktifkan mode pembayaran Cash: tampilkan panel keypad,
 * sembunyikan panel QRIS, dan reset tampilan nominal/kembalian.
 * Tombol "Konfirmasi Pembayaran" tetap nonaktif sampai nominal cukup.
 */
function handleCashPayment() {
  document.getElementById('cashPanel').hidden = false;
  document.getElementById('qrisPanel').hidden = true;
  updateCashDisplay();
  document.getElementById('btnConfirmPayment').disabled = true;
}

/**
 * Mengaktifkan mode pembayaran QRIS: tampilkan kode/instruksi QRIS,
 * sembunyikan panel Cash. QRIS dianggap langsung siap dikonfirmasi
 * (status pesanan tetap otomatis "Menunggu" setelah checkout).
 */
function handleQRISPayment() {
  document.getElementById('cashPanel').hidden = true;
  document.getElementById('qrisPanel').hidden = false;
  document.getElementById('btnConfirmPayment').disabled = false;
}

/** Tombol angka keypad (0-9 dan 000) */
function numberClick(key) {
  // Batasi nominal maksimal 9 digit (hingga ratusan juta) agar tidak absurd
  if (state.cashInput.length >= 9) return;
  state.cashInput += key;
  updateCashDisplay();
}

/** Tombol hapus 1 digit terakhir (⌫) */
function backspace() {
  state.cashInput = state.cashInput.slice(0, -1);
  updateCashDisplay();
}

/** Tombol Clear: hapus seluruh nominal yang sudah diketik */
function clear() {
  state.cashInput = '';
  updateCashDisplay();
}

/**
 * Update tampilan "Uang Diterima" dan hitung kembalian secara otomatis.
 * Jika uang diterima < Grand Total, tampilkan peringatan "Kurang ..."
 * dan nonaktifkan tombol konfirmasi.
 */
function updateCashDisplay() {
  const cashValue = parseInt(state.cashInput || '0', 10);
  document.getElementById('cashAmountDisplay').textContent = formatRupiah(cashValue);

  const total = calcGrandTotal();
  const change = cashValue - total;
  const changeRow = document.getElementById('changeRow');
  const changeDisplay = document.getElementById('changeDisplay');
  const confirmBtn = document.getElementById('btnConfirmPayment');

  if (cashValue <= 0) {
    changeRow.classList.remove('insufficient');
    changeDisplay.textContent = formatRupiah(0);
    confirmBtn.disabled = true;
  } else if (change < 0) {
    changeRow.classList.add('insufficient');
    changeDisplay.textContent = 'Kurang ' + formatRupiah(Math.abs(change));
    confirmBtn.disabled = true;
  } else {
    changeRow.classList.remove('insufficient');
    changeDisplay.textContent = formatRupiah(change);
    confirmBtn.disabled = false;
  }
}

/* ==========================================================
   3. KONFIRMASI PEMBAYARAN -> BUAT PESANAN
   ========================================================== */

/**
 * Finalisasi pembayaran: validasi ulang, buat objek pesanan baru
 * dengan status awal "menunggu", pindahkan dari keranjang ke
 * riwayat pesanan, lalu kosongkan keranjang & form pelanggan.
 * Setelah itu, data langsung diunggah ke GitHub Gist (database online)
 * menggantikan localStorage.
 */
async function confirmPayment() {
  if (!state.paymentMethod) {
    showToast('Pilih metode pembayaran terlebih dahulu');
    return;
  }

  const total = calcGrandTotal();
  let cashGiven = null;
  let change = null;

  if (state.paymentMethod === 'cash') {
    cashGiven = parseInt(state.cashInput || '0', 10);
    if (cashGiven < total) {
      showToast('Uang diterima belum mencukupi');
      return;
    }
    change = cashGiven - total;
  }

  const order = {
    orderId: 'ORD-' + String(state.orderCounter).padStart(4, '0'),
    createdAt: new Date(),
    customer: { ...state.customer },
    items: state.cart.map((i) => ({ ...i })),
    total,
    payment: state.paymentMethod,
    cashGiven,
    change,
    status: 'menunggu', // status default setelah checkout
  };
  state.orderCounter += 1;
  state.orders.unshift(order);

  // Kosongkan keranjang & form pelanggan untuk transaksi berikutnya
  state.cart = [];
  state.customer = { nama: '', metode: 'ambil', tujuan: 'Ambil di Tempat' };
  document.getElementById('custName').value = '';
  document.getElementById('custDest').value = '';
  setDestMode('ambil');
  state.db.cartDirty = false; // keranjang sudah kosong, tidak perlu diautosave lagi

  renderCart();
  renderOrderHistory();
  updateDashboard();
  closeCheckoutModal();
  showToast(`Pesanan ${order.orderId} berhasil dibuat`);

  // Simpan transaksi baru ke GitHub Gist (database online).
  // Kalau gagal (misal sedang offline), pesanan TETAP tersimpan di
  // memori aplikasi & tetap bisa dipakai; nanti tinggal tekan "Refresh"
  // di dashboard atau checkout berikutnya untuk mencoba sinkron lagi.
  try {
    await saveAllTransactionsToGitHub();
    await saveCartToGitHub(); // kosongkan juga cart.json di Gist
    showToast('💾 Data tersimpan ke GitHub');
  } catch (err) {
    showToast('⚠️ Pesanan tersimpan lokal, tapi gagal sinkron ke GitHub');
  }
}

/* ==========================================================
   4. STATUS PESANAN & RIWAYAT PESANAN
   ========================================================== */

/**
 * Mengubah status sebuah pesanan (mis. "menunggu" -> "selesai"),
 * lalu menyinkronkan perubahan itu ke GitHub Gist (Update pada CRUD).
 * @param {string} orderId
 * @param {string} newStatus - 'menunggu' | 'selesai'
 */
async function updateOrderStatus(orderId, newStatus) {
  const order = state.orders.find((o) => o.orderId === orderId);
  if (!order) return;

  order.status = newStatus;
  renderOrderHistory();
  updateDashboard();
  showToast(`${order.orderId} ditandai ${newStatus === 'selesai' ? 'selesai' : 'menunggu'}`);

  try {
    await saveAllTransactionsToGitHub();
  } catch (err) {
    showToast('⚠️ Status tersimpan lokal, gagal sinkron ke GitHub');
  }
}

/**
 * Render seluruh riwayat pesanan beserta status masing-masing.
 * Setiap pesanan yang masih "Menunggu" punya tombol untuk
 * mengubah status menjadi "Selesai".
 */
function renderOrderHistory() {
  const listEl = document.getElementById('orderList');
  const emptyHint = document.getElementById('orderEmptyHint');

  listEl.innerHTML = '';

  if (state.orders.length === 0) {
    emptyHint.hidden = false;
    return;
  }
  emptyHint.hidden = true;

  state.orders.forEach((order) => {
    const card = document.createElement('div');
    card.className = 'order-card';

    const timeStr = order.createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const paymentLabel = order.payment === 'cash' ? 'Cash' : 'QRIS';
    const isSelesai = order.status === 'selesai';

const itemsHtml = order.items.map(item => {
    let detail = "";

    if (item.rice) detail += ` • ${item.rice}`;
    if (item.eggType) detail += ` • Telur ${item.eggType}`;

    return `
        <div class="history-item">
            • ${item.qty}x ${item.name}
            ${detail ? `<div class="history-detail">${detail}</div>` : ""}
        </div>
    `;
}).join("");
    
    card.innerHTML = `
      <div class="order-card-info">
    <span class="order-card-id">
        ${order.orderId} • ${timeStr} • ${paymentLabel}
    </span>

    <span class="order-card-name">
        ${escapeHtml(order.customer.nama || '-')}
    </span>

    <span class="order-card-dest">
        ${escapeHtml(order.customer.tujuan || '-')}
    </span>

    <div class="history-items">
        ${itemsHtml}
    </div>
<div class="order-card-meta">

    <div class="payment-summary">
        <span class="order-card-total">
            Total : ${formatRupiah(order.total)}
        </span>

        ${order.payment === 'cash' ? `
            <span class="order-card-paid">
                Bayar : ${formatRupiah(order.cashGiven)}
            </span>

            <span class="order-card-change">
                Kembalian : ${formatRupiah(order.change)}
            </span>
        ` : ''}
    </div>


        ${isSelesai ? 'Selesai' : 'Menunggu'}
    </span>
        <button type="button" class="btn-status" ${isSelesai ? 'disabled' : ''}>
          ${isSelesai ? 'Selesai ✓' : 'Tandai Selesai'}
        </button>
        <button type="button" class="icon-btn danger btn-delete-order" aria-label="Hapus pesanan">🗑</button>
      </div>
    `;

    if (!isSelesai) {
      card.querySelector('.btn-status').addEventListener('click', () => {
        updateOrderStatus(order.orderId, 'selesai');
      });
    }
    card.querySelector('.btn-delete-order').addEventListener('click', () => {
      deleteTransaction(order.orderId);
    });

    listEl.appendChild(card);
  });
}

/* ==========================================================
   5. INISIALISASI EVENT LISTENER
   ========================================================== */

function initApp() {
  // Jam header
  updateClock();
  setInterval(updateClock, 30000);

  // Data pelanggan (juga menandai keranjang "dirty" agar ikut ter-autosave)
  document.getElementById('custName').addEventListener('input', (e) => {
    state.customer.nama = e.target.value;
    markCartDirty();
  });
  document.getElementById('custDest').addEventListener('input', (e) => {
    state.customer.tujuan = e.target.value;
    markCartDirty();
  });

  // Tombol "Ambil di Tempat" / "Antar" — alamat hanya muncul kalau "Antar" dipilih
  document.querySelectorAll('.dest-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => setDestMode(btn.dataset.mode));
  });

  // Pencarian
  document.getElementById('searchInput').addEventListener('input', (e) => {
    handleSearchInput(e.target.value);
  });

  // Tab kategori
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.activeCategory = tab.dataset.cat;
      syncCategoryTabs();
      renderMenu();
    });
  });

  // Modal item: tombol qty & konfirmasi
  document.getElementById('itemQtyMinus').addEventListener('click', () => changeModalQty(-1));
  document.getElementById('itemQtyPlus').addEventListener('click', () => changeModalQty(1));
  document.getElementById('itemModalConfirm').addEventListener('click', confirmItemModal);
  document.getElementById('itemModalClose').addEventListener('click', closeItemModal);
  document.getElementById('itemModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'itemModalOverlay') closeItemModal();
  });

  // Checkout -> buka modal pembayaran
  document.getElementById('btnCheckout').addEventListener('click', processCheckout);
  document.getElementById('checkoutModalClose').addEventListener('click', closeCheckoutModal);
  document.getElementById('checkoutModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'checkoutModalOverlay') closeCheckoutModal();
  });

  // Pilih metode pembayaran (Cash / QRIS)
  document.querySelectorAll('.payment-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectPaymentMethod(btn.dataset.method));
  });

  // Keypad cash: angka 0-9, 000, backspace
  document.getElementById('keypad').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    const key = btn.dataset.key;
    if (key === 'back') {
      backspace();
    } else {
      numberClick(key);
    }
  });
  document.getElementById('btnClearCash').addEventListener('click', clear);

  // Konfirmasi pembayaran -> buat pesanan
  document.getElementById('btnConfirmPayment').addEventListener('click', confirmPayment);

  // Jalur rahasia ke menu admin: pencet logo pojok kiri atas -> minta kode
  document.getElementById('brandMarkBtn').addEventListener('click', openSecretCodeModal);
  document.getElementById('secretCodeModalClose').addEventListener('click', closeSecretCodeModal);
  document.getElementById('secretCodeModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'secretCodeModalOverlay') closeSecretCodeModal();
  });
  document.getElementById('secretCodeSubmit').addEventListener('click', submitSecretCode);
  document.getElementById('secretCodeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitSecretCode();
  });

  // Tutup modal dengan tombol Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeItemModal();
      closeCheckoutModal();
      closeSecretCodeModal();
    }
  });

  // Render awal (memakai data lokal/default dulu; akan ditimpa ulang
  // oleh data dari GitHub Gist begitu koneksi database siap)
  syncCategoryTabs();
  renderMenu();
  renderCart();
  renderOrderHistory();
  updateDashboard();

  // Inisialisasi koneksi database online (GitHub Gist) — didefinisikan
  // di script-part4.js: buka modal pengaturan kalau belum tersambung,
  // atau langsung load data + jalankan autosave kalau sesi sebelumnya
  // sudah pernah konek.
  initDatabaseIntegration();
}

document.addEventListener('DOMContentLoaded', initApp);

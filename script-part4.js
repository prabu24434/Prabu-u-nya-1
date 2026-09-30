/* ==========================================================
   script-part4.js — PART 4
   Database online menggantikan localStorage: menyimpan &
   mengambil data lewat GitHub Gist REST API — TAPI tidak lagi
   lewat browser langsung. Semua request GitHub Gist dilakukan
   oleh Vercel Serverless Function di /api/gist.js, yang membaca
   GITHUB_TOKEN & GIST_ID dari Environment Variables di server.

   Browser tidak pernah menyimpan atau melihat token sama sekali —
   jauh lebih aman dibanding token diketik lewat modal di browser.
   ========================================================== */

/* ==========================================================
   1. GistDB — client tipis yang bicara ke /api/gist (bukan ke
   api.github.com langsung). Semua kredensial ada di server.
   ========================================================== */

const GistDB = {
  // Selalu true: validasi kredensial sesungguhnya terjadi di server
  // (lewat GITHUB_TOKEN & GIST_ID di Environment Variables Vercel).
  ready: true,

  /** Baca satu "file/tabel" JSON lewat proxy /api/gist. null kalau file belum ada. */
  async readFile(filename) {
    const res = await fetch(`/api/gist?file=${encodeURIComponent(filename)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.value;
  },

  /** Tulis/replace satu "file/tabel" JSON lewat proxy /api/gist. */
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

/* ==========================================================
   2. INDIKATOR STATUS KONEKSI (pill di topbar)
   ========================================================== */

function setDbStatus(kind, text) {
  const dot = document.getElementById('dbStatusDot');
  const label = document.getElementById('dbStatusText');
  if (!dot || !label) return;
  dot.className = 'db-status-dot ' + kind; // online | offline | syncing | error
  label.textContent = text;
}

/* ==========================================================
   3. SIMPAN (CREATE/UPDATE) KE GITHUB
   ========================================================== */

/** Unggah seluruh riwayat transaksi (state.orders) ke transactions.json di Gist */
async function saveAllTransactionsToGitHub() {
  if (!GistDB.ready) return;
  setDbStatus('syncing', 'Menyimpan...');
  try {
    const serializable = state.orders.map((o) => ({ ...o, createdAt: o.createdAt.toISOString() }));
    await GistDB.writeFile('transactions.json', serializable);
    state.db.lastSyncAt = new Date();
    setDbStatus('online', 'Tersambung');
  } catch (err) {
    console.error('Gagal menyimpan transaksi ke GitHub:', err);
    setDbStatus('error', 'Gagal menyimpan');
    throw err;
  }
}

/** Unggah keranjang aktif (biar tidak hilang kalau halaman ter-refresh) ke cart.json di Gist */
async function saveCartToGitHub() {
  if (!GistDB.ready) return;
  try {
    await GistDB.writeFile('cart.json', {
      cart: state.cart,
      customer: state.customer,
      savedAt: new Date().toISOString(),
    });
    state.db.cartDirty = false;
    state.db.lastSyncAt = new Date();
    if (!state.cart.length) return; // kosongkan tanpa toast biar tidak berisik
    setDbStatus('online', 'Tersambung');
  } catch (err) {
    console.error('Gagal autosave keranjang ke GitHub:', err);
    setDbStatus('error', 'Gagal sinkron');
    // Sengaja tidak menampilkan toast di sini supaya tidak spam tiap 5 detik;
    // status koneksi cukup dilihat lewat pill "Gagal sinkron" di topbar.
  }
}

/** Autosave keranjang setiap 5 detik, HANYA kalau ada perubahan (cartDirty) & DB siap */
function startCartAutosave() {
  clearInterval(startCartAutosave._timer);
  startCartAutosave._timer = setInterval(() => {
    if (GistDB.ready && state.db.cartDirty) {
      saveCartToGitHub();
    }
  }, 5000);
}

/* ==========================================================
   4. DELETE (CRUD keempat: hapus transaksi)
   ========================================================== */

async function deleteTransaction(orderId) {
  const idx = state.orders.findIndex((o) => o.orderId === orderId);
  if (idx === -1) return;

  const confirmed = window.confirm(`Hapus pesanan ${orderId}? Tindakan ini tidak bisa dibatalkan.`);
  if (!confirmed) return;

  state.orders.splice(idx, 1);
  renderOrderHistory();
  updateDashboard();

  try {
    await saveAllTransactionsToGitHub();
    showToast(`${orderId} dihapus & tersimpan ke GitHub`);
  } catch (err) {
    showToast(`${orderId} dihapus lokal, tapi gagal sinkron ke GitHub`);
  }
}

/* ==========================================================
   5. DASHBOARD: pendapatan & jumlah transaksi hari ini + grafik
   ========================================================== */

function updateDashboard() {
  const revenueEl = document.getElementById('dashRevenueToday');
  const countEl = document.getElementById('dashCountToday');
  const menungguEl = document.getElementById('dashCountMenunggu');
  const selesaiEl = document.getElementById('dashCountSelesai');
  if (!revenueEl) return; // dashboard belum ada di halaman ini

  const todayStr = new Date().toDateString();
  const todayOrders = state.orders.filter((o) => o.createdAt.toDateString() === todayStr);
  const revenueToday = todayOrders.reduce((sum, o) => sum + o.total, 0);

  revenueEl.textContent = formatRupiah(revenueToday);
  countEl.textContent = String(todayOrders.length);
  menungguEl.textContent = String(state.orders.filter((o) => o.status === 'menunggu').length);
  selesaiEl.textContent = String(state.orders.filter((o) => o.status === 'selesai').length);

  renderRevenueChart();
}

/** Grafik batang sederhana: total pendapatan 7 hari terakhir (tanpa library eksternal) */
function renderRevenueChart() {
  const container = document.getElementById('chartBars');
  if (!container) return;
  container.innerHTML = '';

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }

  const totals = days.map((d) =>
    state.orders
      .filter((o) => o.createdAt.toDateString() === d.toDateString())
      .reduce((sum, o) => sum + o.total, 0)
  );

  const max = Math.max(...totals, 1);

  days.forEach((d, idx) => {
    const col = document.createElement('div');
    col.className = 'chart-bar-col';
    col.title = d.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'short' }) +
      ': ' + formatRupiah(totals[idx]);

    const heightPct = Math.max(Math.round((totals[idx] / max) * 100), totals[idx] > 0 ? 4 : 0);

    col.innerHTML = `
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="height:${heightPct}%"></div>
      </div>
      <span class="chart-bar-label">${d.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
    `;
    container.appendChild(col);
  });
}

/* ==========================================================
   6. MODAL INFO KONEKSI DATABASE
   Tidak ada lagi input Gist ID / Token di browser — semua kredensial
   ada di Environment Variables Vercel. Modal ini murni informatif
   (status koneksi); tidak ada lagi tombol tes koneksi manual, karena
   koneksi sudah otomatis dicoba saat halaman dibuka (lihat
   initDatabaseIntegration di bawah) dan tombol "Refresh" di dashboard
   sudah cukup untuk mencoba ulang.
   ========================================================== */

function openDbConfigModal() {
  document.getElementById('dbConfigError').hidden = true;
  document.getElementById('dbConfigModalOverlay').classList.add('open');
}

function closeDbConfigModal() {
  document.getElementById('dbConfigModalOverlay').classList.remove('open');
}

/** Muat data dari GitHub, lalu render ulang semua bagian yang bergantung padanya */
async function bootstrapFromGitHub() {
  await loadInitialDataFromGitHub();
  renderMenu();
  syncCategoryTabs();
  renderCart();
  renderOrderHistory();
  updateDashboard();
  startCartAutosave();
}

/* ==========================================================
   7. INISIALISASI INTEGRASI DATABASE
   Dipanggil dari initApp() di script-part3.js.
   ========================================================== */

function initDatabaseIntegration() {
  document.getElementById('btnDbSettings').addEventListener('click', openDbConfigModal);
  document.getElementById('dbConfigModalClose').addEventListener('click', closeDbConfigModal);
  document.getElementById('dbConfigModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'dbConfigModalOverlay') closeDbConfigModal();
  });

  document.getElementById('btnRefreshDashboard').addEventListener('click', async () => {
    showToast('Memuat ulang data...');
    try {
      await bootstrapFromGitHub();
      showToast('Data terbaru dimuat');
    } catch (err) {
      showToast('Gagal memuat ulang: ' + err.message);
    }
  });

  // Langsung coba konek otomatis saat halaman dibuka — kredensial sudah
  // ada di server (Environment Variables Vercel), jadi tidak perlu
  // menunggu user mengisi apa pun.
  setDbStatus('syncing', 'Menghubungkan...');
  GistDB.readFile('transactions.json')
    .then(async () => {
      state.db.configured = true;
      await bootstrapFromGitHub();
    })
    .catch((err) => {
      console.error(err);
      state.db.configured = false;
      setDbStatus('error', 'Gagal tersambung');
      // Buka modal info supaya kasir tahu ada yang perlu dibenahi
      // (biasanya: env var GITHUB_TOKEN/GIST_ID belum diset di Vercel).
      openDbConfigModal();
      document.getElementById('dbConfigError').textContent =
        'Gagal tersambung: ' + err.message;
      document.getElementById('dbConfigError').hidden = false;
    });
}

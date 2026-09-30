/* ==========================================================
   script-part2.js — PART 2
   Render menu, modal pemilihan varian (nasi / telur), dan
   SELURUH LOGIKA KERANJANG:
     - addToCart()
     - removeFromCart()
     - editCartItem()
     - updateQuantity()
     - calculateGrandTotal()
     - renderCart()
   Semua fungsi bekerja di atas `state` & data menu dari
   script-part1.js (MENU_GORENGAN, MENU_SERUNDENG, RICE_OPTIONS,
   EGG_OPTIONS, formatRupiah, generateId, findMenuById, dst).
   ========================================================== */

/* ==========================================================
   1. RENDER MENU (daftar item + tombol tambah)
   ========================================================== */

function getActiveMenuList() {
  if (state.activeCategory === 'semua') return [...MENU_GORENGAN, ...MENU_SERUNDENG];
  return state.activeCategory === 'gorengan' ? MENU_GORENGAN : MENU_SERUNDENG;
}

function renderMenu() {
  const grid = document.getElementById('menuGrid');
  const emptyHint = document.getElementById('menuEmptyHint');
  const list = getActiveMenuList();
  const term = state.searchTerm.trim().toLowerCase();

  const filtered = term
    ? list.filter((item) => item.name.toLowerCase().includes(term))
    : list;

  grid.innerHTML = '';

  if (filtered.length === 0) {
    emptyHint.hidden = false;
    return;
  }
  emptyHint.hidden = true;

  filtered.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'menu-item';
    card.dataset.menuId = item.id;

    const unitHtml = item.unit
      ? `<span class="menu-item-unit">${escapeHtml(item.unit)}</span>`
      : `<span class="menu-item-unit">1 paket + nasi</span>`;

    const catHtml = state.activeCategory === 'semua'
      ? `<span class="menu-item-cat ${MENU_GORENGAN.includes(item) ? 'is-gorengan' : 'is-serundeng'}">${MENU_GORENGAN.includes(item) ? 'Gorengan' : 'Serundeng'}</span>`
      : '';

    card.innerHTML = `
      ${catHtml}
      <span class="menu-item-name">${escapeHtml(item.name)}</span>
      ${unitHtml}
      <div class="menu-item-bottom">
        <span class="menu-item-price">${formatRupiah(item.price)}</span>
        <button type="button" class="menu-item-add" data-action="add-to-cart" aria-label="Tambah ke Keranjang">+</button>
      </div>
    `;

    // Tombol "Tambah ke Keranjang" pada setiap item menu.
    // Untuk item yang butuh nasi/telur, modal varian akan terbuka dulu;
    // konfirmasi di dalam modal itulah yang memanggil addToCart().
    card.querySelector('[data-action="add-to-cart"]').addEventListener('click', (e) => {
      e.stopPropagation();
      openItemModal(item.id);
    });
    card.addEventListener('click', () => openItemModal(item.id));

    grid.appendChild(card);
  });
}

/** Pencarian menu lintas kategori (auto pindah tab bila hasil hanya ada di kategori lain) */
function handleSearchInput(value) {
  state.searchTerm = value;
  const term = value.trim().toLowerCase();

  if (term) {
    const activeHasMatch = getActiveMenuList().some((m) => m.name.toLowerCase().includes(term));
    if (!activeHasMatch && state.activeCategory !== 'semua') {
      const otherCat = state.activeCategory === 'gorengan' ? 'serundeng' : 'gorengan';
      const otherList = otherCat === 'gorengan' ? MENU_GORENGAN : MENU_SERUNDENG;
      const otherHasMatch = otherList.some((m) => m.name.toLowerCase().includes(term));
      if (otherHasMatch) {
        state.activeCategory = otherCat;
        syncCategoryTabs();
      }
    }
  }
  renderMenu();
}

function syncCategoryTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.cat === state.activeCategory);
  });
}

/* ==========================================================
   2. MODAL PEMILIHAN VARIAN (nasi wajib, telur dadar/ceplok)
   Dipakai baik untuk menambah item baru maupun mengedit item
   yang sudah ada di keranjang.
   ========================================================== */

function openItemModal(menuId, editCartId) {
  const menuItem = findMenuById(menuId);
  if (!menuItem) return;

  state.currentModalItem = menuItem;
  state.editingCartId = editCartId || null;
  state.selectedEgg = null;
  state.selectedRice = null;
  state.modalQty = 1;

  const category = MENU_GORENGAN.includes(menuItem) ? 'Gorengan' : 'Paket Serundeng';

  document.getElementById('itemModalCategory').textContent = category;
  document.getElementById('itemModalTitle').textContent = menuItem.name;
  document.getElementById('itemModalPrice').textContent = formatRupiah(menuItem.price) +
    (menuItem.unit ? ` / ${menuItem.unit}` : '');
  document.getElementById('itemModalError').hidden = true;

  const eggGroup = document.getElementById('eggOptionGroup');
  const riceGroup = document.getElementById('riceOptionGroup');
  const eggChips = document.getElementById('eggChipGroup');
  const riceChips = document.getElementById('riceChipGroup');

  eggChips.innerHTML = '';
  riceChips.innerHTML = '';

  // Untuk menu "Telur": wajib pilih Dadar atau Ceplok
  if (menuItem.hasEggType) {
    eggGroup.hidden = false;
    EGG_OPTIONS.forEach((opt) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = opt;
      chip.addEventListener('click', () => {
        state.selectedEgg = opt;
        syncChipSelection(eggChips, opt);
      });
      eggChips.appendChild(chip);
    });
  } else {
    eggGroup.hidden = true;
  }

  // Semua Paket Serundeng: wajib pilih nasi
  if (menuItem.requiresRice) {
    riceGroup.hidden = false;
    RICE_OPTIONS.forEach((opt) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = opt;
      chip.addEventListener('click', () => {
        state.selectedRice = opt;
        syncChipSelection(riceChips, opt);
      });
      riceChips.appendChild(chip);
    });
  } else {
    riceGroup.hidden = true;
  }

  // Mode edit: isi ulang pilihan yang sudah tersimpan di keranjang
  if (editCartId) {
    const existing = state.cart.find((c) => c.cartId === editCartId);
    if (existing) {
      state.modalQty = existing.qty;
      if (existing.eggType) {
        state.selectedEgg = existing.eggType;
        syncChipSelection(eggChips, existing.eggType);
      }
      if (existing.rice) {
        state.selectedRice = existing.rice;
        syncChipSelection(riceChips, existing.rice);
      }
    }
    document.getElementById('itemModalConfirm').textContent = 'Simpan Perubahan';
  } else {
    document.getElementById('itemModalConfirm').textContent = 'Tambah ke Keranjang';
  }

  document.getElementById('itemQtyValue').textContent = state.modalQty;
  document.getElementById('itemModalOverlay').classList.add('open');
}

function syncChipSelection(container, value) {
  container.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('selected', chip.textContent === value);
  });
}

function closeItemModal() {
  document.getElementById('itemModalOverlay').classList.remove('open');
  state.currentModalItem = null;
  state.editingCartId = null;
}

function changeModalQty(delta) {
  const next = state.modalQty + delta;
  if (next < 1) return; // qty minimal 1
  state.modalQty = next;
  document.getElementById('itemQtyValue').textContent = state.modalQty;
}

/**
 * Dipanggil saat tombol konfirmasi di modal varian ditekan.
 * Meneruskan ke addToCart() (item baru) atau editCartItem() (item lama),
 * lalu menampilkan pesan error di modal bila validasi gagal.
 */
function confirmItemModal() {
  const menuItem = state.currentModalItem;
  if (!menuItem) return;

  const options = {
    qty: state.modalQty,
    rice: state.selectedRice,
    eggType: state.selectedEgg,
  };

  const result = state.editingCartId
    ? editCartItem(state.editingCartId, options)
    : addToCart(menuItem.id, options);

  const errorEl = document.getElementById('itemModalError');
  if (!result.success) {
    errorEl.textContent = result.error;
    errorEl.hidden = false;
    return;
  }
  errorEl.hidden = true;

  showToast(state.editingCartId ? 'Item keranjang diperbarui' : 'Ditambahkan ke keranjang');
  closeItemModal();
  renderCart();
}

/* ==========================================================
   3. LOGIKA KERANJANG
   ========================================================== */

/**
 * Validasi pilihan wajib (nasi / telur) untuk sebuah menu.
 * Mengembalikan { valid, error }.
 */
function validateCartOptions(menuItem, options) {
  if (menuItem.hasEggType && !options.eggType) {
    return { valid: false, error: 'Silakan pilih jenis telur (Dadar/Ceplok) terlebih dahulu.' };
  }
  if (menuItem.requiresRice && !options.rice) {
    return { valid: false, error: 'Silakan pilih nasi terlebih dahulu.' };
  }
  if (!options.qty || options.qty < 1) {
    return { valid: false, error: 'Jumlah minimal 1.' };
  }
  return { valid: true, error: null };
}

/**
 * Menambahkan menu ke keranjang.
 * @param {string} menuId - id menu (dari MENU_GORENGAN / MENU_SERUNDENG)
 * @param {{qty:number, rice?:string, eggType?:string}} options
 * @returns {{success:boolean, error?:string, cartId?:string}}
 */
function addToCart(menuId, options) {
  const menuItem = findMenuById(menuId);
  if (!menuItem) {
    return { success: false, error: 'Menu tidak ditemukan.' };
  }

  const opts = {
    qty: (options && options.qty) || 1,
    rice: (options && options.rice) || null,
    eggType: (options && options.eggType) || null,
  };

  const validation = validateCartOptions(menuItem, opts);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const cartId = generateId('cart');

  state.cart.push({
    cartId,
    menuId: menuItem.id,
    name: menuItem.name,
    unit: menuItem.unit || null,
    price: menuItem.price,
    qty: opts.qty,
    eggType: opts.eggType,
    rice: opts.rice,
  });

  renderCart();
  return { success: true, cartId };
}

/**
 * Mengubah item yang sudah ada di keranjang (qty dan/atau pilihan).
 * @param {string} cartId
 * @param {{qty:number, rice?:string, eggType?:string}} options
 * @returns {{success:boolean, error?:string}}
 */
function editCartItem(cartId, options) {
  const item = state.cart.find((c) => c.cartId === cartId);
  if (!item) {
    return { success: false, error: 'Item keranjang tidak ditemukan.' };
  }

  const menuItem = findMenuById(item.menuId);
  const opts = {
    qty: (options && options.qty) || item.qty,
    rice: options && 'rice' in options ? options.rice : item.rice,
    eggType: options && 'eggType' in options ? options.eggType : item.eggType,
  };

  const validation = validateCartOptions(menuItem, opts);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  item.qty = opts.qty;
  item.rice = opts.rice;
  item.eggType = opts.eggType;

  renderCart();
  return { success: true };
}

/**
 * Menghapus satu item dari keranjang berdasarkan cartId.
 */
function removeFromCart(cartId) {
  const exists = state.cart.some((c) => c.cartId === cartId);
  if (!exists) return;

  state.cart = state.cart.filter((c) => c.cartId !== cartId);
  renderCart();
  showToast('Item dihapus dari keranjang');
}

/**
 * Mengubah quantity item di keranjang lewat tombol +/- pada baris keranjang.
 * Quantity minimal 1 — tidak akan otomatis terhapus, gunakan removeFromCart()
 * untuk menghapus item sepenuhnya.
 * @param {string} cartId
 * @param {number} delta - +1 atau -1
 */
function updateQuantity(cartId, delta) {
  const item = state.cart.find((c) => c.cartId === cartId);
  if (!item) return;

  const nextQty = item.qty + delta;

  if (nextQty < 1) {
    showToast('Jumlah minimal 1. Gunakan tombol hapus untuk menghapus item.');
    return;
  }

  item.qty = nextQty;
  renderCart();
}

/**
 * Menghitung subtotal satu baris item keranjang (harga satuan x qty).
 */
function calculateCartItemSubtotal(item) {
  return item.price * item.qty;
}

/**
 * Menghitung Grand Total seluruh item di keranjang.
 * @returns {number}
 */
function calculateGrandTotal() {
  return state.cart.reduce((sum, item) => sum + calculateCartItemSubtotal(item), 0);
}

/* ==========================================================
   4. RENDER KERANJANG
   Menampilkan setiap item dengan: nama menu, pilihan (nasi +
   telur), harga satuan, quantity, dan subtotal — rapi dan mudah
   dibaca, plus Grand Total yang otomatis terupdate.
   ========================================================== */

function renderCart() {
  const listEl = document.getElementById('cartList');
  const emptyHint = document.getElementById('cartEmptyHint');
  const countEl = document.getElementById('cartCount');
  const grandTotalEl = document.getElementById('grandTotal');
  const checkoutBtn = document.getElementById('btnCheckout');

  listEl.innerHTML = '';

  if (state.cart.length === 0) {
    emptyHint.hidden = false;
    checkoutBtn.disabled = true;
  } else {
    emptyHint.hidden = true;
    checkoutBtn.disabled = false;

    state.cart.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.dataset.cartId = item.cartId;

      // Baris pilihan: unit (mis. "4 pcs") + nasi + telur dadar/ceplok
      const variantParts = [];
      if (item.unit) variantParts.push(item.unit);
      if (item.rice) variantParts.push(item.rice);
      if (item.eggType) variantParts.push(`Telur ${item.eggType}`);
      const variantText = variantParts.join(' • ');

      const subtotal = calculateCartItemSubtotal(item);

      row.innerHTML = `
        <div class="cart-item-top">
          <div>
            <div class="cart-item-name">${escapeHtml(item.name)}</div>
            ${variantText ? `<div class="cart-item-variant">${escapeHtml(variantText)}</div>` : ''}
            <div class="cart-item-variant">${formatRupiah(item.price)} &times; ${item.qty}</div>
          </div>
          <div class="cart-item-price">${formatRupiah(subtotal)}</div>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-mini">
            <button type="button" data-action="minus" aria-label="Kurangi jumlah">−</button>
            <span>${item.qty}</span>
            <button type="button" data-action="plus" aria-label="Tambah jumlah">+</button>
          </div>
          <div class="cart-item-actions">
            <button type="button" class="icon-btn" data-action="edit" aria-label="Edit item">✎</button>
            <button type="button" class="icon-btn danger" data-action="delete" aria-label="Hapus item">🗑</button>
          </div>
        </div>
      `;

      row.querySelector('[data-action="minus"]').addEventListener('click', () => updateQuantity(item.cartId, -1));
      row.querySelector('[data-action="plus"]').addEventListener('click', () => updateQuantity(item.cartId, 1));
      row.querySelector('[data-action="edit"]').addEventListener('click', () => openItemModal(item.menuId, item.cartId));
      row.querySelector('[data-action="delete"]').addEventListener('click', () => removeFromCart(item.cartId));

      listEl.appendChild(row);
    });
  }

  countEl.textContent = `${state.cart.reduce((sum, i) => sum + i.qty, 0)} item`;
  grandTotalEl.textContent = formatRupiah(calculateGrandTotal());

  // Tandai keranjang berubah supaya autosave (setiap 5 detik, lihat
  // script-part4.js -> startCartAutosave) tahu ada yang perlu diunggah
  // ulang ke GitHub Gist. Keranjang TIDAK pernah disimpan ke localStorage.
  markCartDirty();
}

/* ==========================================================
   5. SINKRONISASI KERANJANG KE DATABASE ONLINE (GITHUB)
   Keranjang tidak lagi disimpan ke localStorage. Sebagai gantinya,
   setiap perubahan hanya menandai state.db.cartDirty = true, lalu
   interval autosave di script-part4.js yang benar-benar mengunggahnya
   ke file cart.json pada GitHub Gist setiap 5 detik.
   ========================================================== */

function markCartDirty() {
  state.db.cartDirty = true;
}

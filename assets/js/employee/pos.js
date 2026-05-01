Auth.guard(['employee', 'admin']);

// ── State ──────────────────────────────────────────────────
let products = [];
let cart     = {}; // { product_id: { product, quantity } }

const peso = v => '₱' + Number(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});

// ── Load products ──────────────────────────────────────────
async function loadProducts() {
    try {
        const data = await Api.get('products/index.php?status=Active');
        products = data.products;
        renderProductGrid(products);
    } catch(e) {
        showToast(e.message, 'error');
    }
}

// ── Render product tiles ───────────────────────────────────
function renderProductGrid(list) {
    const grid = document.getElementById('productGrid');
    if (!list.length) {
        grid.innerHTML = '<div style="color:var(--mist);font-size:.85rem;grid-column:1/-1;">No products found.</div>';
        return;
    }
    grid.innerHTML = list.map(p => {
        const outOfStock = p.stock <= 0;
        const stockClass = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : '';
        const stockLabel = p.stock <= 0 ? 'Out of stock' : `${p.stock} in stock`;
        return `
            <div class="product-tile ${outOfStock ? 'out-of-stock' : ''}"
                 onclick="${outOfStock ? '' : `addToCart(${p.id})`}">
                <div class="tile-name">${escHtml(p.product_name)}</div>
                <div class="tile-cat">${escHtml(p.category)}</div>
                <div class="tile-price">${peso(p.price)}</div>
                <div class="tile-stock ${stockClass}">${stockLabel}</div>
            </div>`;
    }).join('');
}

// ── Filter while searching ─────────────────────────────────
function filterProducts() {
    const q = document.getElementById('posSearch').value.toLowerCase();
    renderProductGrid(q ? products.filter(p => p.product_name.toLowerCase().includes(q)) : products);
}

// ── Cart operations ────────────────────────────────────────
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (!cart[productId]) {
        cart[productId] = { product, quantity: 1 };
    } else {
        if (cart[productId].quantity >= product.stock) {
            showToast(`Only ${product.stock} in stock.`, 'error');
            return;
        }
        cart[productId].quantity++;
    }
    renderCart();
}

function changeQty(productId, delta) {
    if (!cart[productId]) return;
    const newQty = cart[productId].quantity + delta;
    if (newQty <= 0) {
        delete cart[productId];
    } else if (newQty > cart[productId].product.stock) {
        showToast('Not enough stock.', 'error');
        return;
    } else {
        cart[productId].quantity = newQty;
    }
    renderCart();
}

function removeFromCart(productId) {
    delete cart[productId];
    renderCart();
}

function clearCart() {
    cart = {};
    document.getElementById('tenderedInput').value = '';
    document.getElementById('changeDisplay').style.display = 'none';
    renderCart();
}

// ── Render cart ────────────────────────────────────────────
function renderCart() {
    const items    = Object.values(cart);
    const cartEl   = document.getElementById('cartItems');
    const countEl  = document.getElementById('cartCount');
    const totalEl  = document.getElementById('totalAmount');
    const itemsEl  = document.getElementById('totalItems');
    const checkBtn = document.getElementById('checkoutBtn');

    if (!items.length) {
        cartEl.innerHTML = `<div class="cart-empty"><span class="empty-icon">🛒</span><span>Tap a product to add it</span></div>`;
        countEl.textContent = '';
        totalEl.textContent = '₱0.00';
        itemsEl.textContent = '0';
        checkBtn.disabled = true;
        document.getElementById('changeDisplay').style.display = 'none';
        return;
    }

    const grandTotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
    const totalQty   = items.reduce((sum, i) => sum + i.quantity, 0);

    cartEl.innerHTML = items.map(({ product: p, quantity: q }) => `
        <div class="cart-item">
            <div class="ci-info">
                <div class="ci-name">${escHtml(p.product_name)}</div>
                <div class="ci-unit">${peso(p.price)} each</div>
                <div class="ci-controls">
                    <button class="qty-btn" onclick="changeQty(${p.id},-1)">−</button>
                    <span class="qty-display">${q}</span>
                    <button class="qty-btn" onclick="changeQty(${p.id},1)">+</button>
                </div>
            </div>
            <span class="ci-subtotal">${peso(p.price * q)}</span>
            <button class="ci-remove" onclick="removeFromCart(${p.id})">✕</button>
        </div>`).join('');

    countEl.textContent = `(${totalQty} item${totalQty !== 1 ? 's' : ''})`;
    totalEl.textContent = peso(grandTotal);
    itemsEl.textContent = totalQty;
    checkBtn.disabled   = false;
    updateChange();
}

// ── Change calculation ─────────────────────────────────────
function getTotal() {
    return Object.values(cart).reduce((s,i) => s + i.product.price * i.quantity, 0);
}

function updateChange() {
    const tendered  = parseFloat(document.getElementById('tenderedInput').value) || 0;
    const total     = getTotal();
    const changeEl  = document.getElementById('changeDisplay');
    const changeVal = document.getElementById('changeVal');
    const checkBtn  = document.getElementById('checkoutBtn');

    if (!Object.keys(cart).length) { changeEl.style.display = 'none'; return; }

    if (tendered > 0) {
        const change = tendered - total;
        changeVal.textContent = peso(Math.abs(change));
        changeEl.style.display = 'flex';
        changeEl.classList.toggle('negative', change < 0);
        checkBtn.disabled = change < 0 || !Object.keys(cart).length;
    } else {
        changeEl.style.display = 'none';
        checkBtn.disabled = true;
    }
}

// ── Process checkout ───────────────────────────────────────
async function processCheckout() {
    const tendered = parseFloat(document.getElementById('tenderedInput').value);
    const total    = getTotal();
    const items    = Object.values(cart).map(({ product: p, quantity: q }) => ({
        product_id: p.id, quantity: q
    }));

    if (!items.length)    return showToast('Cart is empty.', 'error');
    if (tendered < total) return showToast('Not enough tendered.', 'error');

    const btn = document.getElementById('checkoutBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
        const data = await Api.post('sales/index.php', { items, amount_tendered: tendered });
        showReceipt(data, tendered, total, items);
    } catch(e) {
        showToast(e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Process Sale';
    }
}

// ── Show receipt ───────────────────────────────────────────
function showReceipt(data, tendered, total, items) {
    const user = Auth.getUser();
    document.getElementById('receiptBranch').textContent =
        `Branch ${user.branch_id === 1 ? 'A' : 'B'} · ${new Date().toLocaleString('en-PH')}`;

    document.getElementById('receiptItems').innerHTML = Object.values(cart).map(({product:p,quantity:q}) =>
        `<div class="receipt-row">
            <span class="label">${escHtml(p.product_name)} × ${q}</span>
            <span class="val">${peso(p.price * q)}</span>
         </div>`).join('');

    document.getElementById('receiptTotal').textContent   = peso(data.total_amount);
    document.getElementById('receiptTendered').textContent= peso(data.amount_tendered);
    document.getElementById('receiptChange').textContent  = peso(data.change_amount);
    document.getElementById('receiptId').textContent      = `Sale #${data.sale_id}`;

    document.getElementById('receiptModal').classList.add('open');
}

function newSale() {
    document.getElementById('receiptModal').classList.remove('open');
    clearCart();
    document.getElementById('checkoutBtn').disabled  = true;
    document.getElementById('checkoutBtn').textContent = 'Process Sale';
    // Refresh products in case stock changed
    loadProducts();
}

function showToast(message, type = 'info') {
    const t = document.getElementById('toast');
    t.textContent = message;
    t.className = `toast show ${type}`;
    setTimeout(() => t.classList.remove('show'), 4000);
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    document.getElementById('posDate').textContent =
        new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
    loadProducts();
});
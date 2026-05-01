Auth.guard(['admin']);
Theme.init('dark');

let products = [];
let cart     = {};
let saleType = 'walk-in';

const peso = v => '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function setSaleType(type, btn) {
    saleType = type;
    document.querySelectorAll('.sale-type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProductGrid(products); // re-render to show exchange prices
}

async function loadProducts() {
    try {
        const data = await Api.get('products/index.php?status=Active');
        products = data.products;
        renderProductGrid(products);
    } catch(e) { showToast(e.message, 'error'); }
}

function renderProductGrid(list) {
    const grid = document.getElementById('productGrid');
    if (!list.length) { grid.innerHTML = '<div style="color:var(--text-sub);font-size:.85rem;grid-column:1/-1;">No products found.</div>'; return; }
    grid.innerHTML = list.map(p => {
        const outOfStock  = p.stock <= 0;
        const stockClass  = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : '';
        const stockLabel  = p.stock <= 0 ? 'Out of stock' : `${p.stock} in stock`;
        const displayPrice = (saleType === 'exchange' && p.exchange_price) ? p.exchange_price : p.price;
        const exchangeTag  = (saleType === 'exchange' && p.exchange_price)
            ? `<div class="tile-exchange">Exchange: ${peso(p.exchange_price)}</div>` : '';

        return `<div class="product-tile ${outOfStock ? 'out-of-stock' : ''}"
                     onclick="${outOfStock ? '' : `addToCart(${p.id})`}">
            <div class="tile-name">${escHtml(p.product_name)}</div>
            <div class="tile-cat">${escHtml(p.category)}</div>
            <div class="tile-price">${peso(displayPrice)}</div>
            ${exchangeTag}
            <div class="tile-stock ${stockClass}">${stockLabel}</div>
        </div>`;
    }).join('');
}

function filterProducts() {
    const q = document.getElementById('posSearch').value.toLowerCase();
    renderProductGrid(q ? products.filter(p => p.product_name.toLowerCase().includes(q)) : products);
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const useExchange = saleType === 'exchange' && product.exchange_price;
    const unitPrice   = useExchange ? parseFloat(product.exchange_price) : parseFloat(product.price);

    if (!cart[productId]) {
        cart[productId] = { product, quantity: 1, unitPrice, useExchange: !!useExchange };
    } else {
        if (cart[productId].quantity >= product.stock) { showToast(`Only ${product.stock} in stock.`, 'error'); return; }
        cart[productId].quantity++;
    }
    renderCart();
}

function changeQty(productId, delta) {
    if (!cart[productId]) return;
    const newQty = cart[productId].quantity + delta;
    if (newQty <= 0) { delete cart[productId]; }
    else if (newQty > cart[productId].product.stock) { showToast('Not enough stock.', 'error'); return; }
    else { cart[productId].quantity = newQty; }
    renderCart();
}

function removeFromCart(productId) { delete cart[productId]; renderCart(); }

function clearCart() {
    cart = {};
    document.getElementById('tenderedInput').value = '';
    document.getElementById('changeDisplay').style.display = 'none';
    renderCart();
}

function renderCart() {
    const items    = Object.values(cart);
    const cartEl   = document.getElementById('cartItems');
    const countEl  = document.getElementById('cartCount');
    const totalEl  = document.getElementById('totalAmount');
    const itemsEl  = document.getElementById('totalItems');
    const checkBtn = document.getElementById('checkoutBtn');

    if (!items.length) {
        cartEl.innerHTML = `<div class="cart-empty"><span class="empty-icon">🛒</span><span>Tap a product to add it</span></div>`;
        countEl.textContent = ''; totalEl.textContent = '₱0.00'; itemsEl.textContent = '0';
        checkBtn.disabled = true;
        document.getElementById('changeDisplay').style.display = 'none';
        return;
    }

    const grandTotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const totalQty   = items.reduce((s, i) => s + i.quantity, 0);

    cartEl.innerHTML = items.map(({ product: p, quantity: q, unitPrice }) => `
        <div class="cart-item">
            <div class="ci-info">
                <div class="ci-name">${escHtml(p.product_name)}</div>
                <div class="ci-unit">${peso(unitPrice)} each${saleType === 'exchange' ? ' (exchange)' : ''}</div>
                <div class="ci-controls">
                    <button class="qty-btn" onclick="changeQty(${p.id},-1)">−</button>
                    <span class="qty-display">${q}</span>
                    <button class="qty-btn" onclick="changeQty(${p.id},1)">+</button>
                </div>
            </div>
            <span class="ci-subtotal">${peso(unitPrice * q)}</span>
            <button class="ci-remove" onclick="removeFromCart(${p.id})">✕</button>
        </div>`).join('');

    countEl.textContent = `(${totalQty})`;
    totalEl.textContent = peso(grandTotal);
    itemsEl.textContent = totalQty;
    checkBtn.disabled   = false;
    updateChange();
}

function getTotal() { return Object.values(cart).reduce((s,i) => s + i.unitPrice * i.quantity, 0); }

function updateChange() {
    const tendered = parseFloat(document.getElementById('tenderedInput').value) || 0;
    const total    = getTotal();
    const changeEl = document.getElementById('changeDisplay');
    if (!Object.keys(cart).length) { changeEl.style.display = 'none'; return; }
    if (tendered > 0) {
        const change = tendered - total;
        document.getElementById('changeVal').textContent = peso(Math.abs(change));
        changeEl.style.display = 'flex';
        changeEl.classList.toggle('negative', change < 0);
        document.getElementById('checkoutBtn').disabled = change < 0 || !Object.keys(cart).length;
    } else {
        changeEl.style.display = 'none';
        document.getElementById('checkoutBtn').disabled = true;
    }
}

async function processCheckout() {
    const tendered = parseFloat(document.getElementById('tenderedInput').value);
    const total    = getTotal();
    const items    = Object.values(cart).map(({ product: p, quantity: q, useExchange }) => ({
        product_id: p.id, quantity: q, use_exchange: useExchange
    }));

    if (!items.length) return showToast('Cart is empty.', 'error');
    if (tendered < total) return showToast('Not enough tendered.', 'error');

    const btn = document.getElementById('checkoutBtn');
    btn.disabled = true; btn.textContent = 'Processing...';

    try {
        const data = await Api.post('sales/index.php', { items, amount_tendered: tendered, sale_type: saleType });
        showReceipt(data);
    } catch(e) {
        showToast(e.message, 'error');
        btn.disabled = false; btn.textContent = 'Process Sale';
    }
}

function showReceipt(data) {
    const user = Auth.getUser();
    document.getElementById('receiptRef').textContent      = data.reference_no;
    document.getElementById('receiptBranch').textContent   = `Branch ${user.branch_id === 1 ? 'A' : 'B'} · ${new Date().toLocaleString('en-PH')}`;
    document.getElementById('receiptType').textContent     = data.sale_type === 'exchange' ? 'Cylinder Exchange' : 'Walk-in Sale';
    document.getElementById('receiptItems').innerHTML      = Object.values(cart).map(({product:p,quantity:q,unitPrice}) =>
        `<div class="receipt-row"><span class="label">${escHtml(p.product_name)} × ${q}</span><span class="val">${peso(unitPrice * q)}</span></div>`).join('');
    document.getElementById('receiptTotal').textContent    = peso(data.total_amount);
    document.getElementById('receiptTendered').textContent = peso(data.amount_tendered);
    document.getElementById('receiptChange').textContent   = peso(data.change_amount);
    document.getElementById('receiptModal').classList.add('open');
}

function newSale() {
    document.getElementById('receiptModal').classList.remove('open');
    clearCart();
    document.getElementById('checkoutBtn').disabled   = true;
    document.getElementById('checkoutBtn').textContent = 'Process Sale';
    loadProducts();
}

function showToast(message, type = 'info') {
    const t = document.getElementById('toast');
    t.textContent = message; t.className = `toast show ${type}`;
    setTimeout(() => t.classList.remove('show'), 4000);
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    document.getElementById('posDate').textContent =
        new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    loadProducts();
});
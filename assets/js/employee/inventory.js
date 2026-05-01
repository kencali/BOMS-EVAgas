// Employee and admin can view stock (guard allows both)
Auth.guard(['employee', 'admin']);

let allProducts = [];

const peso = v =>
    '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Load stock using the existing products API ─────────────
// Reuses GET /api/products/index.php — no new API needed
async function loadStock() {
    document.getElementById('stockGrid').innerHTML =
        '<div class="empty-state">Loading...</div>';
    try {
        // status=all so employees can see 0-stock items too
        const data  = await Api.get('products/index.php?status=Active');
        allProducts = data.products;
        document.getElementById('stockCount').textContent =
            `${data.count} product${data.count !== 1 ? 's' : ''}`;
        renderGrid(allProducts);
    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('stockGrid').innerHTML =
            '<div class="empty-state" style="color:var(--red);">Failed to load stock.</div>';
    }
}

// ── Filter by search input ─────────────────────────────────
function filterStock() {
    const q = document.getElementById('stockSearch').value.toLowerCase();
    renderGrid(q
        ? allProducts.filter(p => p.product_name.toLowerCase().includes(q))
        : allProducts
    );
}

// ── Render product stock cards ─────────────────────────────
function renderGrid(products) {
    const grid = document.getElementById('stockGrid');

    if (!products.length) {
        grid.innerHTML = '<div class="empty-state">No products found.</div>';
        return;
    }

    grid.innerHTML = products.map(p => {
        // Stock level classification
        const level     = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'good';
        const cardClass = level;
        const stockClass= level;

        return `
            <div class="stock-card ${cardClass}">
                <div class="sc-name">${escHtml(p.product_name)}</div>
                <div class="sc-cat">${escHtml(p.category)}</div>
                <div>
                    <span class="sc-stock ${stockClass}">${p.stock}</span>
                    <span class="sc-unit">units</span>
                </div>
                <div class="sc-price">${peso(p.price)}</div>
            </div>`;
    }).join('');
}

function showToast(message, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className   = `toast show ${type}`;
    setTimeout(() => el.classList.remove('show'), 4000);
}

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    loadStock();
});
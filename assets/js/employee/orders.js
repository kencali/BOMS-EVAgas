// Employee (and admin) can view today's sales
Auth.guard(['employee', 'admin']);

const peso = v =>
    '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Load today's sales using existing sales API ────────────
// Reuses GET /api/sales/index.php — no new PHP needed
async function loadOrders() {
    document.getElementById('ordersTableBody').innerHTML =
        `<tr><td colspan="6" class="table-empty">Loading...</td></tr>`;
    try {
        const today  = new Date().toISOString().split('T')[0];
        const params = new URLSearchParams({ date_from: today, date_to: today });
        const data   = await Api.get(`sales/index.php?${params.toString()}`);

        // Summary — IDs: statRevenue, statCount
        document.getElementById('statRevenue').textContent = peso(data.total);
        document.getElementById('statCount').textContent   = data.count;

        renderTable(data.sales);
    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('ordersTableBody').innerHTML =
            `<tr><td colspan="6" class="table-empty" style="color:var(--red);">Failed to load sales.</td></tr>`;
    }
}

// ── Render table rows ──────────────────────────────────────
function renderTable(sales) {
    const tbody = document.getElementById('ordersTableBody');
    if (!sales.length) {
        tbody.innerHTML =
            `<tr><td colspan="6" class="table-empty">
                No sales yet today.<br/>
                <a href="/BOMS-EVAgas/public/employee/pos.html"
                   style="color:var(--flame);text-decoration:none;font-weight:600;">
                   Go to POS →
                </a>
             </td></tr>`;
        return;
    }
    tbody.innerHTML = sales.map(s => `
        <tr>
            <td class="mono" style="color:var(--mist);">#${s.id}</td>
            <td style="font-size:.82rem;color:var(--mist);">
                ${new Date(s.sale_date).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}
            </td>
            <td class="mono" style="color:var(--green);font-weight:600;">${peso(s.total_amount)}</td>
            <td class="mono">${peso(s.amount_tendered)}</td>
            <td class="mono">${peso(s.change_amount)}</td>
            <td><button class="btn-view" onclick="viewDetail(${s.id})">View</button></td>
        </tr>`).join('');
}

// ── View sale detail ───────────────────────────────────────
async function viewDetail(saleId) {
    try {
        const s = await Api.get(`sales/index.php?id=${saleId}`);
        document.getElementById('detailTitle').textContent = `Sale #${s.id}`;
        document.getElementById('detailBody').innerHTML = `
            <div class="detail-row">
                <span class="lbl">Time</span>
                <span class="val">${new Date(s.sale_date).toLocaleTimeString('en-PH')}</span>
            </div>
            <hr class="detail-divider"/>
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--mist);margin-bottom:.5rem;">Items</div>
            ${(s.items || []).map(i => `
                <div class="item-row">
                    <span>${escHtml(i.product_name)} × ${i.quantity}</span>
                    <span class="mono">${peso(i.subtotal)}</span>
                </div>`).join('')}
            <hr class="detail-divider"/>
            <div class="detail-row">
                <span class="lbl">Total</span>
                <span class="val" style="color:var(--green);font-weight:700;">${peso(s.total_amount)}</span>
            </div>
            <div class="detail-row">
                <span class="lbl">Tendered</span>
                <span class="val">${peso(s.amount_tendered)}</span>
            </div>
            <div class="detail-row">
                <span class="lbl">Change</span>
                <span class="val" style="color:var(--green);">${peso(s.change_amount)}</span>
            </div>`;
        document.getElementById('detailModal').classList.add('open');
    } catch (err) { showToast(err.message, 'error'); }
}

function closeDetail() { document.getElementById('detailModal').classList.remove('open'); }

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

document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) closeDetail();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDetail();
});

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    document.getElementById('todayLabel').textContent =
        new Date().toLocaleDateString('en-PH', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    loadOrders();
});
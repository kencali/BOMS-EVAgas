Auth.guard(['admin']);

const peso = v => '₱' + Number(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});
const currentUser = Auth.getUser();
let viewBranch    = currentUser.branch_id;

// Set default date range (current month)
const today    = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
document.getElementById('dateFrom').value = firstDay.toISOString().split('T')[0];
document.getElementById('dateTo').value   = today.toISOString().split('T')[0];

async function loadSales() {
    document.getElementById('salesTableBody').innerHTML = '<tr><td colspan="7" class="table-empty">Loading...</td></tr>';
    try {
        const from   = document.getElementById('dateFrom').value;
        const to     = document.getElementById('dateTo').value;
        const params = new URLSearchParams({ branch_id: viewBranch, date_from: from, date_to: to });
        const data   = await Api.get(`sales/index.php?${params}`);

        // Summary
        document.getElementById('sumRevenue').textContent = peso(data.total);
        document.getElementById('sumCount').textContent   = data.count;
        document.getElementById('sumAvg').textContent     = data.count > 0 ? peso(data.total / data.count) : '₱0.00';
        document.getElementById('salesCount').textContent = `${data.count} record${data.count !== 1 ? 's' : ''}`;

        renderTable(data.sales);
    } catch(e) {
        showToast(e.message, 'error');
    }
}

function renderTable(sales) {
    const tbody = document.getElementById('salesTableBody');
    if (!sales.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No sales found for this period.</td></tr>';
        return;
    }
    tbody.innerHTML = sales.map(s => `
        <tr>
            <td class="mono" style="color:var(--mist);">#${s.id}</td>
            <td>${new Date(s.sale_date).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
            <td style="color:var(--cream);">${s.cashier_name || '—'}</td>
            <td class="mono" style="color:var(--green);font-weight:600;">${peso(s.total_amount)}</td>
            <td class="mono">${peso(s.amount_tendered)}</td>
            <td class="mono">${peso(s.change_amount)}</td>
            <td><button class="btn-view" onclick="viewDetail(${s.id})">View</button></td>
        </tr>`).join('');
}

async function viewDetail(saleId) {
    try {
        const s = await Api.get(`sales/index.php?id=${saleId}`);
        document.getElementById('detailTitle').textContent = `Sale #${s.id}`;
        document.getElementById('detailBody').innerHTML = `
            <div class="detail-row"><span class="lbl">Date</span><span class="val">${new Date(s.sale_date).toLocaleString('en-PH')}</span></div>
            <div class="detail-row"><span class="lbl">Cashier</span><span class="val">${s.cashier_name || '—'}</span></div>
            <hr class="detail-divider"/>
            <div style="font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;color:var(--mist);margin-bottom:.5rem;">Items</div>
            ${(s.items||[]).map(i=>`
                <div class="item-row">
                    <span>${i.product_name} × ${i.quantity}</span>
                    <span class="mono">${peso(i.subtotal)}</span>
                </div>`).join('')}
            <hr class="detail-divider"/>
            <div class="detail-row"><span class="lbl">Total</span><span class="val" style="color:var(--green);font-weight:700;">${peso(s.total_amount)}</span></div>
            <div class="detail-row"><span class="lbl">Tendered</span><span class="val">${peso(s.amount_tendered)}</span></div>
            <div class="detail-row"><span class="lbl">Change</span><span class="val" style="color:var(--green);">${peso(s.change_amount)}</span></div>`;
        document.getElementById('detailModal').classList.add('open');
    } catch(e) { showToast(e.message, 'error'); }
}

function closeDetail() { document.getElementById('detailModal').classList.remove('open'); }

function switchBranch(b) {
    viewBranch = b;
    document.querySelectorAll('.branch-btn').forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.branch) === b));
    const isOwn = b === currentUser.branch_id;
    const badge = document.getElementById('viewingBadge');
    badge.textContent = `Branch ${b === 1 ? 'A' : 'B'} ${isOwn ? '(your branch)' : '(read-only)'}`;
    badge.className = `branch-view-badge ${isOwn ? 'own' : 'other'}`;
    loadSales();
}

function showToast(msg, type='info') {
    const t = document.getElementById('toast');
    t.textContent = msg; t.className = `toast show ${type}`;
    setTimeout(() => t.classList.remove('show'), 4000);
}

// ── Set correct branch tab on load based on logged-in user ─
function initBranchUI() {
    const branchId = currentUser.branch_id;
    document.querySelectorAll('.branch-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.branch) === branchId);
    });
    const badge = document.getElementById('viewingBadge');
    badge.textContent = `Branch ${branchId === 1 ? 'A' : 'B'} (your branch)`;
    badge.className   = 'branch-view-badge own';
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeDetail(); });
document.addEventListener('click',   e => { if(e.target.classList.contains('modal-backdrop')) closeDetail(); });

document.addEventListener('DOMContentLoaded', () => { 
    renderSidebar(); 
    initBranchUI(); 
    loadSales(); 
});

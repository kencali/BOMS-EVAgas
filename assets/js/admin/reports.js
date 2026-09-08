// ============================================================
// FILE: assets/js/admin/reports.js
// PLACE IN: /assets/js/admin/reports.js
//
// HTML IDs this file reads/writes (verified against reports.html):
//   viewingBadge, dateFrom, dateTo, periodStart, periodEnd,
//   activeTab (data-tab attribute on buttons),
//
//   -- Summary tab --
//   sumRevenue, sumExpenses, sumNetIncome,
//   sumEmployees, sumDeliveries, sumLowStock, summaryChart,
//
//   -- Sales tab --
//   salesTotalRevenue, salesTotalTx, salesAvg, salesHighest,
//   salesTopBody, salesChart,
//
//   -- Expenses tab --
//   expTotal, expEntries, expAvg,
//   expCategoryBody, expChart,
//
//   -- Payroll tab --
//   payTotalGross, payTotalDed, payTotalNet, payCount,
//   payrollBody,
//
//   -- Inventory tab --
//   invTotal, invOut, invLow, invOk, invValue, inventoryBody,
//
//   toast
//
// API calls (verified against api/reports/index.php):
//   GET reports/index.php?type=summary  &branch_id=N&date_from=Y-m-d&date_to=Y-m-d
//   GET reports/index.php?type=sales    &branch_id=N&date_from=Y-m-d&date_to=Y-m-d
//   GET reports/index.php?type=expenses &branch_id=N&date_from=Y-m-d&date_to=Y-m-d
//   GET reports/index.php?type=payroll  &branch_id=N&period_start=Y-m-d&period_end=Y-m-d
//   GET reports/index.php?type=inventory&branch_id=N
// ============================================================

Auth.guard(['admin']);

// ── Module-level state ─────────────────────────────────────
const currentUser = Auth.getUser();
let   viewBranch  = currentUser.branch_id;
let   activeTab   = 'summary'; // current tab: summary|sales|expenses|payroll|inventory
let   chartInst   = {};        // stores Chart.js instances so we can destroy/recreate

// ── Utility ────────────────────────────────────────────────
const peso = v =>
    '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className   = `toast show ${type}`;
    setTimeout(() => el.classList.remove('show'), 4500);
}

// ── Set default date range (current month) ─────────────────
function setDefaultDates() {
    const now      = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt      = d => d.toISOString().split('T')[0];
    document.getElementById('dateFrom').value    = fmt(firstDay);
    document.getElementById('dateTo').value      = fmt(now);
    document.getElementById('periodStart').value = fmt(firstDay);
    document.getElementById('periodEnd').value   = fmt(lastDay);
    document.querySelectorAll('#dateFrom, #dateTo, #periodStart, #periodEnd')
        .forEach(input => input.dispatchEvent(new Event('change')));
}

// ── Build API params for current tab ──────────────────────
function buildParams(type) {
    const p = new URLSearchParams({ type, branch_id: viewBranch });
    if (type === 'payroll') {
        p.set('period_start', document.getElementById('periodStart').value);
        p.set('period_end',   document.getElementById('periodEnd').value);
    } else if (type !== 'inventory') {
        p.set('date_from', document.getElementById('dateFrom').value);
        p.set('date_to',   document.getElementById('dateTo').value);
    }
    return p.toString();
}

// ── Chart helper: destroys old instance before creating new ─
function makeChart(canvasId, config) {
    if (chartInst[canvasId]) {
        chartInst[canvasId].destroy();
    }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    chartInst[canvasId] = new Chart(ctx.getContext('2d'), config);
}

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { labels: { color: '#9E9B92', font: { family: 'Sora', size: 11 } } }
    },
    scales: {
        x: { ticks: { color: '#9E9B92', font: { family: 'Sora', size: 10 } },
              grid: { color: 'rgba(40,35,29,.10)' } },
        y: { ticks: { color: '#9E9B92', font: { family: 'Sora', size: 10 },
                       callback: v => '₱' + Number(v).toLocaleString() },
              grid: { color: 'rgba(40,35,29,.10)' } },
    }
};

// ── Tab switching ──────────────────────────────────────────
function switchTab(tab) {
    activeTab = tab;

    // Toggle tab button active state
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // Show/hide tab panels
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.style.display = panel.dataset.panel === tab ? 'block' : 'none';
    });

    // Show/hide correct date controls
    document.getElementById('dateRangeControls').style.display =
        ['summary','sales','expenses'].includes(tab) ? 'flex' : 'none';
    document.getElementById('periodControls').style.display =
        tab === 'payroll' ? 'flex' : 'none';

    loadActiveTab();
}

// ── Load whichever tab is active ───────────────────────────
function loadActiveTab() {
    const loaders = {
        summary:   loadSummary,
        sales:     loadSalesReport,
        expenses:  loadExpensesReport,
        payroll:   loadPayrollReport,
        inventory: loadInventoryReport,
    };
    if (loaders[activeTab]) loaders[activeTab]();
}

// ── SUMMARY TAB ───────────────────────────────────────────
async function loadSummary() {
    try {
        const data = await Api.get(`reports/index.php?${buildParams('summary')}`);

        document.getElementById('sumRevenue').textContent    = peso(data.revenue);
        document.getElementById('sumExpenses').textContent   = peso(data.expenses);
        document.getElementById('sumNetIncome').textContent  = peso(data.net_income);
        document.getElementById('sumNetIncome').style.color  =
            data.net_income >= 0 ? 'var(--green)' : 'var(--red)';
        document.getElementById('sumEmployees').textContent  = data.active_employees;
        document.getElementById('sumDeliveries').textContent = data.pending_deliveries;
        document.getElementById('sumLowStock').textContent   = data.low_stock;

        makeChart('summaryChart', {
            type: 'bar',
            data: {
                labels:   data.chart_labels,
                datasets: [{
                    label: 'Monthly Revenue',
                    data:  data.chart_revenue,
                    backgroundColor: 'rgba(255,75,31,.35)',
                    borderColor:     '#FF4B1F',
                    borderWidth:     2,
                    borderRadius:    6,
                }]
            },
            options: { ...CHART_DEFAULTS, plugins: {
                ...CHART_DEFAULTS.plugins,
                tooltip: { callbacks: { label: c => ' ' + peso(c.raw) } }
            }}
        });
    } catch (err) { showToast(err.message, 'error'); }
}

// ── SALES REPORT TAB ──────────────────────────────────────
async function loadSalesReport() {
    try {
        const data = await Api.get(`reports/index.php?${buildParams('sales')}`);
        const t    = data.totals;

        document.getElementById('salesTotalRevenue').textContent = peso(t.total_revenue);
        document.getElementById('salesTotalTx').textContent      = t.total_transactions;
        document.getElementById('salesAvg').textContent          = peso(t.avg_per_sale);
        document.getElementById('salesHighest').textContent      = peso(t.highest_sale);

        // Top products table
        const tbody = document.getElementById('salesTopBody');
        tbody.innerHTML = !data.top_products.length
            ? `<tr><td colspan="3" class="table-empty">No sales data.</td></tr>`
            : data.top_products.map((p,i) => `
                <tr>
                    <td style="color:var(--mist);font-family:'Space Mono',monospace;">#${i+1}</td>
                    <td>${escHtml(p.product_name)}</td>
                    <td class="mono">${p.total_qty} units</td>
                    <td class="mono" style="color:var(--green);">${peso(p.total_revenue)}</td>
                </tr>`).join('');

        makeChart('salesChart', {
            type: 'line',
            data: {
                labels: data.monthly.map(m => m.month_label),
                datasets: [{
                    label:           'Revenue',
                    data:            data.monthly.map(m => parseFloat(m.revenue)),
                    borderColor:     '#FF4B1F',
                    backgroundColor: 'rgba(255,75,31,.08)',
                    borderWidth:     2.5,
                    pointRadius:     4,
                    tension:         0.4,
                    fill:            true,
                }]
            },
            options: { ...CHART_DEFAULTS, plugins: {
                ...CHART_DEFAULTS.plugins,
                tooltip: { callbacks: { label: c => ' ' + peso(c.raw) } }
            }}
        });
    } catch (err) { showToast(err.message, 'error'); }
}

// ── EXPENSES REPORT TAB ───────────────────────────────────
async function loadExpensesReport() {
    try {
        const data = await Api.get(`reports/index.php?${buildParams('expenses')}`);
        const t    = data.totals;

        document.getElementById('expTotal').textContent   = peso(t.total_expenses);
        document.getElementById('expEntries').textContent = t.total_entries;
        document.getElementById('expAvg').textContent     = peso(t.avg_expense);

        // Category breakdown table
        const tbody = document.getElementById('expCategoryBody');
        tbody.innerHTML = !data.by_category.length
            ? `<tr><td colspan="3" class="table-empty">No expense data.</td></tr>`
            : data.by_category.map(c => `
                <tr>
                    <td>${escHtml(c.category)}</td>
                    <td style="color:var(--mist);">${c.entries}</td>
                    <td class="mono" style="color:var(--red);">${peso(c.subtotal)}</td>
                </tr>`).join('');

        // Expenses doughnut chart
        makeChart('expChart', {
            type: 'doughnut',
            data: {
                labels:   data.by_category.map(c => c.category),
                datasets: [{
                    data:            data.by_category.map(c => parseFloat(c.subtotal)),
                    backgroundColor: ['#FF4B1F','#FF9F0A','#5AC8FA','#34C759','#9E9B92'],
                    borderWidth:     0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { color: '#9E9B92', font: { family: 'Sora', size: 11 } } },
                    tooltip: { callbacks: { label: c => ' ' + peso(c.raw) } }
                }
            }
        });
    } catch (err) { showToast(err.message, 'error'); }
}

// ── PAYROLL REPORT TAB ────────────────────────────────────
async function loadPayrollReport() {
    try {
        const data = await Api.get(`reports/index.php?${buildParams('payroll')}`);
        const t    = data.totals;

        document.getElementById('payTotalGross').textContent = peso(t.total_gross);
        document.getElementById('payTotalDed').textContent   = peso(t.total_deductions);
        document.getElementById('payTotalNet').textContent   = peso(t.total_net);
        document.getElementById('payCount').textContent      = t.employee_count;

        const tbody = document.getElementById('payrollBody');
        tbody.innerHTML = !data.records.length
            ? `<tr><td colspan="6" class="table-empty">No payroll records for this period.</td></tr>`
            : data.records.map(r => `
                <tr>
                    <td>
                        <div style="font-weight:600;color:var(--cream);">${escHtml(r.employee_name)}</div>
                        <div style="font-size:.72rem;color:var(--mist);">${escHtml(r.employee_position)}</div>
                    </td>
                    <td class="mono">${r.days_worked}</td>
                    <td class="mono">₱${Number(r.daily_rate).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                    <td class="mono" style="color:var(--amber);">${peso(r.gross_pay)}</td>
                    <td class="mono" style="color:var(--red);">${peso(r.deductions)}</td>
                    <td class="mono" style="color:var(--green);font-weight:700;">${peso(r.net_pay)}</td>
                </tr>`).join('');
    } catch (err) { showToast(err.message, 'error'); }
}

// ── INVENTORY REPORT TAB ──────────────────────────────────
async function loadInventoryReport() {
    try {
        const data = await Api.get(`reports/index.php?${buildParams('inventory')}`);
        const s    = data.summary;

        document.getElementById('invTotal').textContent = s.total_products;
        document.getElementById('invOut').textContent   = s.out_of_stock;
        document.getElementById('invLow').textContent   = s.low_stock;
        document.getElementById('invOk').textContent    = s.ok_stock;
        document.getElementById('invValue').textContent = peso(s.stock_value);

        const tbody = document.getElementById('inventoryBody');
        tbody.innerHTML = !data.products.length
            ? `<tr><td colspan="4" class="table-empty">No products found.</td></tr>`
            : data.products.map(p => {
                const level = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
                const cls   = { out:'stock-out', low:'stock-low', ok:'stock-ok' }[level];
                return `
                    <tr>
                        <td style="font-weight:600;color:var(--cream);">${escHtml(p.product_name)}</td>
                        <td style="color:var(--mist);">${escHtml(p.category)}</td>
                        <td><span class="stock-badge ${cls}">${p.stock} units</span></td>
                        <td class="mono" style="color:var(--mist);">${peso(p.stock_value)}</td>
                    </tr>`;
            }).join('');
    } catch (err) { showToast(err.message, 'error'); }
}

// ── Branch switcher ────────────────────────────────────────
function switchBranch(branchId) {
    viewBranch = branchId;
    document.querySelectorAll('.branch-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.branch) === branchId);
    });
    const isOwn = branchId === currentUser.branch_id;
    const badge = document.getElementById('viewingBadge');
    badge.textContent = `Branch ${branchId === 1 ? 'A' : 'B'} ${isOwn ? '(your branch)' : '(read-only)'}`;
    badge.className   = `branch-view-badge ${isOwn ? 'own' : 'other'}`;
    loadActiveTab();
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

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    initBranchUI();
    setDefaultDates();
    switchTab('summary'); // load summary tab first
});

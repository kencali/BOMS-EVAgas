// ============================================================
// FILE: assets/js/admin/dashboard.js
// PURPOSE: Fetches dashboard stats from the API and renders
//          the stat cards, chart, and low stock table.
//
// This replaces ALL the PHP that was mixed into dashboard.php.
// No PHP here — just fetch, display, repeat.
// ============================================================

// ── Page guard: redirect if not logged in or not admin ────
// (This runs immediately when the page loads)
Auth.guard(['admin']);

// ── Which branch are we viewing? ──────────────────────────
const currentUser = Auth.getUser();
let viewingBranch  = currentUser.branch_id; // start with own branch

// ── Chart instance (stored so we can destroy/recreate it) ─
let salesChart = null;

// ── Format numbers as Philippine Peso ─────────────────────
function peso(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ── Load all dashboard data ────────────────────────────────
async function loadDashboard(branchId) {
    showSkeletons(); // show loading placeholders

    try {
        const data = await Api.get(`dashboard/index.php?branch_id=${branchId}`);
        renderStats(data.stats);
        renderChart(data.chart);
        renderLowStock(data.low_stock);
        updateBranchBadge(data);

    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ── Render the 6 stat cards ────────────────────────────────
function renderStats(stats) {
    const cards = [
        {
            id:    'stat-sales',
            label: 'Total Sales',
            value: peso(stats.total_sales),
            color: 'green',
            icon:  '₱'
        },
        {
            id:    'stat-expenses',
            label: 'Total Expenses',
            value: peso(stats.total_expenses),
            color: 'red',
            icon:  '⊖'
        },
        {
            id:    'stat-income',
            label: 'Net Income',
            value: peso(stats.net_income),
            color: stats.net_income >= 0 ? 'green' : 'red',
            icon:  stats.net_income >= 0 ? '↑' : '↓'
        },
        {
            id:    'stat-products',
            label: 'Total Products',
            value: stats.total_products,
            color: 'blue',
            icon:  '⊞'
        },
        {
            id:    'stat-employees',
            label: 'Active Employees',
            value: stats.total_employees,
            color: 'amber',
            icon:  '⊛'
        },
        {
            id:    'stat-deliveries',
            label: 'Pending Deliveries',
            value: stats.total_pending,
            color: stats.total_pending > 0 ? 'red' : 'green',
            icon:  '⊕'
        },
    ];

    cards.forEach(card => {
        const el = document.getElementById(card.id);
        if (!el) return;
        el.querySelector('.stat-value').textContent = card.value;
        el.querySelector('.stat-value').className   = `stat-value color-${card.color}`;
    });
}

// ── Render Chart.js line chart ─────────────────────────────
function renderChart({ labels, totals }) {
    const ctx = document.getElementById('salesChart').getContext('2d');

    if (salesChart) salesChart.destroy(); // destroy old chart first

    // If no data yet, show a message
    if (!labels.length) {
        document.getElementById('chartEmpty').style.display = 'block';
        return;
    }
    document.getElementById('chartEmpty').style.display = 'none';

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Monthly Sales (₱)',
                data: totals,
                borderColor: '#FF4B1F',
                backgroundColor: 'rgba(255,75,31,.08)',
                borderWidth: 2.5,
                pointBackgroundColor: '#FF4B1F',
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.4,
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#9E9B92', font: { family: 'Sora', size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ' ' + peso(ctx.raw)
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#9E9B92', font: { family: 'Sora', size: 11 } },
                    grid:  { color: 'rgba(255,255,255,.05)' }
                },
                y: {
                    ticks: {
                        color: '#9E9B92',
                        font:  { family: 'Sora', size: 11 },
                        callback: val => '₱' + Number(val).toLocaleString()
                    },
                    grid: { color: 'rgba(255,255,255,.05)' }
                }
            }
        }
    });
}

// ── Render low stock table ─────────────────────────────────
function renderLowStock(items) {
    const tbody = document.getElementById('lowStockBody');
    if (!items.length) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;color:#9E9B92;padding:1.5rem;">
            No low stock items 👍</td></tr>`;
        return;
    }
    tbody.innerHTML = items.map(item => `
        <tr>
            <td>${item.product_name}</td>
            <td class="stock-qty ${item.stock <= 2 ? 'critical' : 'warning'}">
                ${item.stock} left
            </td>
        </tr>
    `).join('');
}

// ── Branch toggle (view own vs other branch) ───────────────
function updateBranchBadge(data) {
    const badge = document.getElementById('viewingBadge');
    if (!data.is_own_branch) {
        badge.textContent = `Viewing: Branch ${data.branch_id === 1 ? 'A' : 'B'} (read-only)`;
        badge.className = 'branch-view-badge other';
    } else {
        badge.textContent = `Branch ${data.branch_id === 1 ? 'A' : 'B'} (your branch)`;
        badge.className = 'branch-view-badge own';
    }
}

function switchBranch(branchId) {
    viewingBranch = branchId;
    document.querySelectorAll('.branch-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.branch) === branchId);
    });
    loadDashboard(branchId);
}

// ── Skeleton loader (shows grey boxes while loading) ───────
function showSkeletons() {
    document.querySelectorAll('.stat-value').forEach(el => {
        el.textContent = '---';
        el.className = 'stat-value color-mist';
    });
}

// ── Simple toast notification ──────────────────────────────
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 4000);
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
    renderSidebar();             // draw sidebar
    initBranchUI();              // initialize branch UI
    loadDashboard(viewingBranch); // fetch and display data
});

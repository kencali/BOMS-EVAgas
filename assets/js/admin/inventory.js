// ============================================================
// FILE: assets/js/admin/inventory.js
// PLACE IN: /assets/js/admin/inventory.js
//
// HTML IDs this file reads/writes (verified against inventory.html):
//   summaryTotal, summaryOut, summaryLow, summaryOk,
//   inventoryTableBody, inventoryCount, viewingBadge,
//   adjustModal, adjustModalTitle, adjustProductName,
//   adjustType, adjustAmount, adjustReason,
//   errAdjustAmount, confirmAdjustBtn,
//   toast
//
// API calls (verified against api/inventory/index.php):
//   GET inventory/index.php?branch_id=N          → full list + summary
//   GET inventory/index.php?branch_id=N&low=1    → low-stock only
//   PUT inventory/index.php?id=N                 → adjust stock
// ============================================================

Auth.guard(['admin']);

// ── Module-level state ─────────────────────────────────────
const currentUser  = Auth.getUser();
let   viewBranch   = currentUser.branch_id;
let   allProducts  = [];   // local cache for filter/search
let   adjustingId  = null; // product ID being adjusted

// ── Utility ────────────────────────────────────────────────
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

// ── Load inventory list + summary ──────────────────────────
async function loadInventory() {
    document.getElementById('inventoryTableBody').innerHTML =
        `<tr><td colspan="5" class="table-empty">Loading...</td></tr>`;

    try {
        const params = new URLSearchParams({ branch_id: viewBranch });
        const data   = await Api.get(`inventory/index.php?${params.toString()}`);

        allProducts = data.products;

        // Update summary cards
        // IDs: summaryTotal, summaryOut, summaryLow, summaryOk
        document.getElementById('summaryTotal').textContent = data.summary.total_products  ?? 0;
        document.getElementById('summaryOut').textContent   = data.summary.out_of_stock    ?? 0;
        document.getElementById('summaryLow').textContent   = data.summary.low_stock       ?? 0;
        document.getElementById('summaryOk').textContent    = data.summary.ok_stock        ?? 0;

        document.getElementById('inventoryCount').textContent =
            `${data.count} product${data.count !== 1 ? 's' : ''}`;

        renderTable(allProducts);

    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('inventoryTableBody').innerHTML =
            `<tr><td colspan="5" class="table-empty" style="color:var(--red);">Failed to load inventory.</td></tr>`;
    }
}

// ── Render table ───────────────────────────────────────────
function renderTable(products) {
    const tbody = document.getElementById('inventoryTableBody');

    if (!products.length) {
        tbody.innerHTML =
            `<tr><td colspan="5" class="table-empty">No products found.</td></tr>`;
        return;
    }

    tbody.innerHTML = products.map(p => {
        const level     = p.stock <= 0 ? 'out' : p.stock <= 5 ? 'low' : 'ok';
        const stockClass = {
            out: 'stock-out',
            low: 'stock-low',
            ok:  'stock-ok',
        }[level];

        const levelLabel = {
            out: '⛔ Out of stock',
            low: '⚠️ Low stock',
            ok:  '✅ In stock',
        }[level];

        // Only allow adjustment when viewing own branch
        const isOwn       = viewBranch === currentUser.branch_id;
        const adjustBtn   = isOwn
            ? `<button class="btn-action adjust"
                       onclick="openAdjustModal(${p.id}, '${escHtml(p.product_name)}', ${p.stock})">
                   Adjust
               </button>`
            : '<span style="color:var(--mist);font-size:.78rem;">Read-only</span>';

        return `
            <tr>
                <td>
                    <div class="prod-name">${escHtml(p.product_name)}</div>
                    <div class="prod-cat">${escHtml(p.category)}</div>
                </td>
                <td>
                    <span class="stock-value ${stockClass}">
                        ${p.stock}
                    </span>
                    <span style="font-size:.72rem;color:var(--mist);margin-left:.25rem;">units</span>
                </td>
                <td><span class="level-badge ${stockClass}">${levelLabel}</span></td>
                <td class="mono" style="color:var(--mist);font-size:.82rem;">
                    ₱${Number(p.price).toLocaleString('en-PH',{minimumFractionDigits:2})}
                </td>
                <td class="col-actions">${adjustBtn}</td>
            </tr>`;
    }).join('');
}

// ── Filter: show only low/out stock ───────────────────────
function filterLow() {
    const low = allProducts.filter(p => p.stock <= 5);
    renderTable(low);
    document.getElementById('inventoryCount').textContent =
        `${low.length} low-stock item${low.length !== 1 ? 's' : ''}`;
}

// ── Reset to full list ─────────────────────────────────────
function filterAll() {
    renderTable(allProducts);
    document.getElementById('inventoryCount').textContent =
        `${allProducts.length} product${allProducts.length !== 1 ? 's' : ''}`;
}

// ── Open stock adjustment modal ────────────────────────────
function openAdjustModal(productId, productName, currentStock) {
    adjustingId = productId;

    // IDs: adjustModalTitle, adjustProductName, adjustType, adjustAmount, adjustReason, errAdjustAmount
    document.getElementById('adjustModalTitle').textContent  = 'Adjust Stock';
    document.getElementById('adjustProductName').textContent = productName;
    document.getElementById('adjustType').value              = 'add';
    document.getElementById('adjustAmount').value            = '';
    document.getElementById('adjustReason').value            = '';
    document.getElementById('errAdjustAmount').textContent   = '';
    document.getElementById('adjustAmount').classList.remove('error');

    // Show current stock in the modal for reference
    document.getElementById('currentStockDisplay').textContent = currentStock;

    document.getElementById('adjustModal').classList.add('open');
}

// ── Submit stock adjustment ────────────────────────────────
async function handleAdjust() {
    document.getElementById('errAdjustAmount').textContent = '';
    document.getElementById('adjustAmount').classList.remove('error');

    const adjustType   = document.getElementById('adjustType').value;
    const adjustAmount = parseInt(document.getElementById('adjustAmount').value);
    const reason       = document.getElementById('adjustReason').value.trim();

    if (isNaN(adjustAmount) || adjustAmount < 0) {
        document.getElementById('adjustAmount').classList.add('error');
        document.getElementById('errAdjustAmount').textContent = 'Enter a valid positive number.';
        return;
    }

    const btn = document.getElementById('confirmAdjustBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    try {
        const data = await Api.put(`inventory/index.php?id=${adjustingId}`, {
            adjust_type: adjustType,   // 'set' | 'add' | 'subtract'
            amount:      adjustAmount,
            reason:      reason,
        });

        showToast(
            `${data.product_name}: ${data.old_stock} → ${data.new_stock} units`,
            'success'
        );
        closeAdjustModal();
        loadInventory();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Confirm Adjustment';
    }
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

    loadInventory();
}

// ── Modal helpers ──────────────────────────────────────────
function closeAdjustModal() {
    document.getElementById('adjustModal').classList.remove('open');
}

document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) closeAdjustModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAdjustModal();
});

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
    loadInventory();
});
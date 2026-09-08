// ============================================================
// FILE: assets/js/admin/deliveries.js
//
// HTML IDs this file reads/writes:
//   deliveryTableBody, deliveryCount, viewingBadge,
//   deliveryModal, modalTitle, submitBtn,
//   fieldCustomerName, fieldCustomerPhone, fieldCustomerAddress,
//   fieldProductId, fieldQuantity, fieldAssignedTo,
//   fieldDeliveryStatus, fieldNotes, statusRow,
//   errCustomerName, errCustomerAddress, errProductId, errQuantity,
//   cancelModal, cancelDeliveryName, confirmCancelBtn,
//   countPending, countOnTheWay, countDelivered, countCancelled,
//   statusFilter, toast
//
// API calls:
//   GET  deliveries/index.php?branch_id=N
//   GET  deliveries/index.php?branch_id=N&status=X
//   GET  deliveries/index.php?deliverers=1&branch_id=N
//   GET  products/index.php?status=Active
//   POST deliveries/index.php
//   PUT  deliveries/index.php?id=N
//   DELETE deliveries/index.php?id=N
// ============================================================

Auth.guard(['admin']);

// ── Module-level state ─────────────────────────────────────
const currentUser   = Auth.getUser();
let   viewBranch    = currentUser.branch_id;
let   editingId     = null;   // null = add mode, number = edit mode
let   allDeliveries = [];     // local cache of loaded deliveries
let   productList   = [];     // for the product dropdown
let   delivererList = [];     // for the assigned-to dropdown

// ── Utility ────────────────────────────────────────────────
const peso = v =>
    '₱' + Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className   = `toast show ${type}`;
    setTimeout(() => el.classList.remove('show'), 4500);
}

// ── Status badge HTML ──────────────────────────────────────
const STATUS_CLASS = {
    'Pending'    : 'status-pending',
    'On the way' : 'status-otw',
    'Delivered'  : 'status-delivered',
    'Cancelled'  : 'status-cancelled',
};

function statusBadge(status) {
    const cls = STATUS_CLASS[status] ?? 'status-pending';
    return `<span class="status-badge ${cls}">${escHtml(status)}</span>`;
}

// ── Load deliveries from API ───────────────────────────────
async function loadDeliveries() {
    document.getElementById('deliveryTableBody').innerHTML =
        `<tr><td colspan="7" class="table-empty">Loading...</td></tr>`;

    try {
        const statusVal = document.getElementById('statusFilter').value;
        const params    = new URLSearchParams({ branch_id: viewBranch });
        if (statusVal !== 'all') params.set('status', statusVal);

        const data = await Api.get(`deliveries/index.php?${params.toString()}`);

        allDeliveries = data.deliveries;

        // Update count badges
        document.getElementById('countPending').textContent    = data.counts['Pending']    ?? 0;
        document.getElementById('countOnTheWay').textContent   = data.counts['On the way'] ?? 0;
        document.getElementById('countDelivered').textContent  = data.counts['Delivered']  ?? 0;
        document.getElementById('countCancelled').textContent  = data.counts['Cancelled']  ?? 0;
        document.getElementById('deliveryCount').textContent   =
            `${allDeliveries.length} record${allDeliveries.length !== 1 ? 's' : ''}`;

        renderTable(allDeliveries);

    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('deliveryTableBody').innerHTML =
            `<tr><td colspan="7" class="table-empty" style="color:var(--red)">Failed to load deliveries.</td></tr>`;
    }
}

// ── Load products and deliverers for dropdowns ─────────────
async function loadDropdownData() {
    try {
        const [prodData, delivData] = await Promise.all([
            Api.get('products/index.php?status=Active'),
            Api.get(`deliveries/index.php?deliverers=1&branch_id=${viewBranch}`),
        ]);
        productList   = prodData.products;
        delivererList = delivData.deliverers;
    } catch (err) {
        showToast('Could not load dropdown data: ' + err.message, 'error');
    }
}

// ── Render table rows ──────────────────────────────────────
function renderTable(deliveries) {
    const tbody = document.getElementById('deliveryTableBody');

    if (!deliveries.length) {
        tbody.innerHTML =
            `<tr><td colspan="7" class="table-empty">No deliveries found.</td></tr>`;
        return;
    }

    tbody.innerHTML = deliveries.map(d => {
        const assignedName = d.assigned_name
            ? escHtml(d.assigned_name)
            : `<span style="color:var(--mist);">Unassigned</span>`;

        const dateStr = new Date(d.created_at).toLocaleDateString('en-PH', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const canCancel   = d.delivery_status !== 'Delivered' && d.delivery_status !== 'Cancelled';
        const canComplete = d.delivery_status === 'On the way';

        return `
            <tr>
                <td class="col-id">#${d.id}</td>
                <td>
                    <div class="customer-name">${escHtml(d.customer_name)}</div>
                    <div class="customer-address">${escHtml(d.customer_address)}</div>
                </td>
                <td>${escHtml(d.product_name)} × ${d.quantity}</td>
                <td>${assignedName}</td>
                <td>${statusBadge(d.delivery_status)}</td>
                <td class="col-date">${dateStr}</td>
                <td class="col-actions">
                    <button class="btn-action edit"
                            onclick="openEditModal(${d.id})">Edit</button>
                    ${canComplete
                        ? `<button class="btn-action deliver"
                                   onclick="completeDelivery(${d.id})">Mark Delivered</button>`
                        : ''}
                    ${canCancel
                        ? `<button class="btn-action cancel"
                                   onclick="confirmCancel(${d.id}, '${escHtml(d.customer_name)}')">Cancel</button>`
                        : ''}
                </td>
            </tr>`;
    }).join('');
}

// ── Populate form dropdowns ────────────────────────────────
function populateDropdowns() {
    const productSel   = document.getElementById('fieldProductId');
    const assignedSel  = document.getElementById('fieldAssignedTo');

    productSel.innerHTML = `<option value="">-- Select Product --</option>` +
        productList.map(p =>
            `<option value="${p.id}">${escHtml(p.product_name)}</option>`
        ).join('');

    assignedSel.innerHTML = `<option value="">-- Unassigned --</option>` +
        delivererList.map(u =>
            `<option value="${u.id}">${escHtml(u.full_name)}</option>`
        ).join('');
}

// ── Open modal: ADD ────────────────────────────────────────
function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent   = 'New Delivery';
    document.getElementById('submitBtn').textContent    = 'Create Delivery';
    document.getElementById('deliveryModal').querySelector('form').reset();
    clearFieldErrors();
    populateDropdowns();
    document.getElementById('deliveryModal').classList.add('open');
}

// ── Open modal: EDIT ───────────────────────────────────────
function openEditModal(id) {
    const delivery = allDeliveries.find(d => d.id === id);
    if (!delivery) return showToast('Delivery not found in cache.', 'error');

    editingId = id;
    document.getElementById('modalTitle').textContent   = `Edit Delivery #${id}`;
    document.getElementById('submitBtn').textContent    = 'Save Changes';
    clearFieldErrors();
    populateDropdowns();

    // Pre-fill fields — names match HTML IDs exactly
    document.getElementById('fieldCustomerName').value    = delivery.customer_name;
    document.getElementById('fieldCustomerPhone').value   = delivery.customer_phone;
    document.getElementById('fieldCustomerAddress').value = delivery.customer_address;
    document.getElementById('fieldProductId').value       = delivery.product_id;
    document.getElementById('fieldQuantity').value        = delivery.quantity;
    document.getElementById('fieldAssignedTo').value      = delivery.assigned_to ?? '';
    document.getElementById('fieldNotes').value           = delivery.notes ?? '';

    document.getElementById('deliveryModal').classList.add('open');
}

// ── Modal: submit (handles add + edit) ────────────────────
async function handleSubmit() {
    clearFieldErrors();

    const body = {
        customer_name:    document.getElementById('fieldCustomerName').value.trim(),
        customer_phone:   document.getElementById('fieldCustomerPhone').value.trim(),
        customer_address: document.getElementById('fieldCustomerAddress').value.trim(),
        product_id:       parseInt(document.getElementById('fieldProductId').value)  || 0,
        quantity:         parseInt(document.getElementById('fieldQuantity').value)    || 0,
        assigned_to:      parseInt(document.getElementById('fieldAssignedTo').value) || null,
        notes:            document.getElementById('fieldNotes').value.trim(),
    };

    // Client-side validation — mirrors server validation
    let valid = true;

    if (!body.customer_name) {
        setFieldError('fieldCustomerName', 'errCustomerName', 'Customer name is required.');
        valid = false;
    }
    if (!body.customer_address) {
        setFieldError('fieldCustomerAddress', 'errCustomerAddress', 'Address is required.');
        valid = false;
    }
    if (!body.product_id) {
        setFieldError('fieldProductId', 'errProductId', 'Please select a product.');
        valid = false;
    }
    if (body.quantity <= 0) {
        setFieldError('fieldQuantity', 'errQuantity', 'Quantity must be at least 1.');
        valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('submitBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    try {
        if (editingId) {
            await Api.put(`deliveries/index.php?id=${editingId}`, body);
            showToast('Delivery updated.', 'success');
        } else {
            await Api.post('deliveries/index.php', body);
            showToast('Delivery created.', 'success');
        }
        closeModal();
        loadDeliveries();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = editingId ? 'Save Changes' : 'Create Delivery';
    }
}

// ── Cancel confirmation modal ──────────────────────────────
function confirmCancel(id, customerName) {
    document.getElementById('cancelDeliveryName').textContent = customerName;
    document.getElementById('cancelModal').dataset.id         = id;
    document.getElementById('cancelModal').classList.add('open');
}

async function executeCancel() {
    const id  = parseInt(document.getElementById('cancelModal').dataset.id);
    const btn = document.getElementById('confirmCancelBtn');
    btn.disabled    = true;
    btn.textContent = 'Cancelling...';

    try {
        await Api.delete(`deliveries/index.php?id=${id}`);
        showToast('Delivery cancelled.', 'success');
        closeCancelModal();
        loadDeliveries();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Yes, Cancel It';
    }
}

// ── Complete delivery explicitly ────────────────────────────
async function completeDelivery(id) {
    if (!window.confirm('Mark this delivery as delivered? This will create its sale and deduct stock.')) {
        return;
    }

    try {
        const result = await Api.put(
            `deliveries/index.php?id=${id}&action=status`,
            { delivery_status: 'Delivered' }
        );
        showToast(`Delivery completed. Sale reference: ${result.reference_no}`, 'success');
        loadDeliveries();
    } catch (err) {
        showToast(err.message, 'error');
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

    // Hide Add button when viewing other branch
    document.getElementById('addDeliveryBtn').style.display = isOwn ? 'flex' : 'none';

    loadDropdownData();
    loadDeliveries();
}

// ── Field error helpers ────────────────────────────────────
function setFieldError(inputId, errorId, message) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(errorId).textContent = message;
}

function clearFieldErrors() {
    ['fieldCustomerName', 'fieldCustomerAddress', 'fieldProductId', 'fieldQuantity']
        .forEach(id => document.getElementById(id).classList.remove('error'));
    ['errCustomerName', 'errCustomerAddress', 'errProductId', 'errQuantity']
        .forEach(id => { document.getElementById(id).textContent = ''; });
}

// ── Modal close helpers ────────────────────────────────────
function closeModal()        { document.getElementById('deliveryModal').classList.remove('open'); }
function closeCancelModal()  { document.getElementById('cancelModal').classList.remove('open'); }

// ── Close on backdrop click or Escape ─────────────────────
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) {
        closeModal();
        closeCancelModal();
    }
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeCancelModal(); }
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
document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar();
    await loadDropdownData();
    initBranchUI();
    loadDeliveries();
});

// ============================================================
// FILE: assets/js/admin/employees.js
// PLACE IN: /assets/js/admin/employees.js
//
// HTML IDs this file reads/writes (must match employees.html exactly):
//   employeeTableBody, employeeCount, viewingBadge,
//   countActive, countInactive,
//   statusFilter,
//   employeeModal, modalTitle, submitBtn, statusRow,
//   fieldFullName, fieldPosition, fieldPhone,
//   fieldAddress, fieldHireDate, fieldDailyRate, fieldStatus,
//   errFullName, errPosition, errDailyRate,
//   deactivateModal, deactivateEmployeeName, confirmDeactivateBtn,
//   toast
//
// API calls (must match api/employees/index.php routes exactly):
//   GET    employees/index.php?branch_id=N&status=X  → list
//   GET    employees/index.php?id=N                  → single (unused, uses cache)
//   POST   employees/index.php                       → create
//   PUT    employees/index.php?id=N                  → update
//   DELETE employees/index.php?id=N                  → deactivate
// ============================================================

Auth.guard(['admin']);

// ── Module-level state ─────────────────────────────────────
const currentUser   = Auth.getUser();
let   viewBranch    = currentUser.branch_id;
let   editingId     = null;       // null = add mode, number = edit mode
let   allEmployees  = [];         // local cache

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

// ── Load employees from API ────────────────────────────────
async function loadEmployees() {
    document.getElementById('employeeTableBody').innerHTML =
        `<tr><td colspan="7" class="table-empty">Loading...</td></tr>`;

    try {
        const statusVal = document.getElementById('statusFilter').value;
        const params    = new URLSearchParams({ branch_id: viewBranch });
        if (statusVal !== 'all') params.set('status', statusVal);

        const data = await Api.get(`employees/index.php?${params.toString()}`);

        allEmployees = data.employees;

        // Update count badges — IDs: countActive, countInactive
        document.getElementById('countActive').textContent   = data.counts['Active']   ?? 0;
        document.getElementById('countInactive').textContent = data.counts['Inactive'] ?? 0;
        document.getElementById('employeeCount').textContent =
            `${data.count} employee${data.count !== 1 ? 's' : ''}`;

        renderTable(allEmployees);

    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('employeeTableBody').innerHTML =
            `<tr><td colspan="7" class="table-empty" style="color:var(--red);">Failed to load employees.</td></tr>`;
    }
}

// ── Render table rows ──────────────────────────────────────
function renderTable(employees) {
    const tbody = document.getElementById('employeeTableBody');

    if (!employees.length) {
        tbody.innerHTML =
            `<tr><td colspan="7" class="table-empty">No employees found.</td></tr>`;
        return;
    }

    tbody.innerHTML = employees.map(emp => {
        const hireDateStr = new Date(emp.hire_date).toLocaleDateString('en-PH', {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        const isOwn     = viewBranch === currentUser.branch_id;
        const canEdit   = isOwn && emp.status === 'Active';
        const canDeact  = isOwn && emp.status === 'Active';

        return `
            <tr>
                <td class="col-id">#${emp.id}</td>
                <td>
                    <div class="emp-name">${escHtml(emp.full_name)}</div>
                    <div class="emp-phone">${escHtml(emp.phone || '—')}</div>
                </td>
                <td>${escHtml(emp.position)}</td>
                <td class="mono">${peso(emp.daily_rate)}<span class="per-day">/day</span></td>
                <td>${hireDateStr}</td>
                <td>
                    <span class="status-badge ${emp.status === 'Active' ? 'active' : 'inactive'}">
                        ${emp.status}
                    </span>
                </td>
                <td class="col-actions">
                    ${canEdit
                        ? `<button class="btn-action edit"
                                   onclick="openEditModal(${emp.id})">Edit</button>`
                        : ''}
                    ${canDeact
                        ? `<button class="btn-action deactivate"
                                   onclick="confirmDeactivate(${emp.id}, '${escHtml(emp.full_name)}')">
                               Deactivate
                           </button>`
                        : ''}
                </td>
            </tr>`;
    }).join('');
}

// ── Open modal: ADD ────────────────────────────────────────
function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent    = 'Add Employee';
    document.getElementById('submitBtn').textContent     = 'Add Employee';
    document.getElementById('statusRow').style.display   = 'none';
    document.getElementById('employeeModal')
            .querySelector('form').reset();
    // Default hire date to today
    document.getElementById('fieldHireDate').value =
        new Date().toISOString().split('T')[0];
    clearFieldErrors();
    document.getElementById('employeeModal').classList.add('open');
}

// ── Open modal: EDIT ───────────────────────────────────────
function openEditModal(id) {
    const emp = allEmployees.find(e => e.id === id);
    if (!emp) return showToast('Employee not found.', 'error');

    editingId = id;
    document.getElementById('modalTitle').textContent    = `Edit Employee`;
    document.getElementById('submitBtn').textContent     = 'Save Changes';
    document.getElementById('statusRow').style.display   = 'flex';
    clearFieldErrors();

    // Pre-fill fields — each id matches the HTML input id exactly
    document.getElementById('fieldFullName').value  = emp.full_name;
    document.getElementById('fieldPosition').value  = emp.position;
    document.getElementById('fieldPhone').value     = emp.phone;
    document.getElementById('fieldAddress').value   = emp.address;
    document.getElementById('fieldHireDate').value  = emp.hire_date;
    document.getElementById('fieldDailyRate').value = emp.daily_rate;
    document.getElementById('fieldStatus').value    = emp.status;

    document.getElementById('employeeModal').classList.add('open');
}

// ── Modal: submit (handles both add and edit) ──────────────
async function handleSubmit() {
    clearFieldErrors();

    // Build request body — field names match DB columns and PHP $body keys
    const body = {
        full_name:  document.getElementById('fieldFullName').value.trim(),
        position:   document.getElementById('fieldPosition').value.trim(),
        phone:      document.getElementById('fieldPhone').value.trim(),
        address:    document.getElementById('fieldAddress').value.trim(),
        hire_date:  document.getElementById('fieldHireDate').value,
        daily_rate: parseFloat(document.getElementById('fieldDailyRate').value) || 0,
        status:     document.getElementById('fieldStatus').value,
    };

    // Client-side validation — mirrors server validation in api/employees/index.php
    let valid = true;

    if (!body.full_name) {
        setFieldError('fieldFullName', 'errFullName', 'Full name is required.');
        valid = false;
    }
    if (!body.position) {
        setFieldError('fieldPosition', 'errPosition', 'Position is required.');
        valid = false;
    }
    if (!body.daily_rate || body.daily_rate <= 0) {
        setFieldError('fieldDailyRate', 'errDailyRate', 'Daily rate must be greater than zero.');
        valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('submitBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    try {
        if (editingId) {
            await Api.put(`employees/index.php?id=${editingId}`, body);
            showToast('Employee updated successfully.', 'success');
        } else {
            await Api.post('employees/index.php', body);
            showToast('Employee added successfully.', 'success');
        }
        closeModal();
        loadEmployees();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = editingId ? 'Save Changes' : 'Add Employee';
    }
}

// ── Deactivate confirmation modal ──────────────────────────
function confirmDeactivate(id, fullName) {
    document.getElementById('deactivateEmployeeName').textContent = fullName;
    document.getElementById('deactivateModal').dataset.id         = id;
    document.getElementById('deactivateModal').classList.add('open');
}

async function executeDeactivate() {
    const id  = parseInt(document.getElementById('deactivateModal').dataset.id);
    const btn = document.getElementById('confirmDeactivateBtn');
    btn.disabled    = true;
    btn.textContent = 'Deactivating...';

    try {
        await Api.delete(`employees/index.php?id=${id}`);
        showToast('Employee deactivated.', 'success');
        closeDeactivateModal();
        loadEmployees();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Yes, Deactivate';
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
    document.getElementById('addEmployeeBtn').style.display = isOwn ? 'flex' : 'none';

    loadEmployees();
}

// ── Field error helpers ────────────────────────────────────
function setFieldError(inputId, errorId, message) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(errorId).textContent = message;
}

function clearFieldErrors() {
    ['fieldFullName', 'fieldPosition', 'fieldDailyRate'].forEach(id => {
        document.getElementById(id).classList.remove('error');
    });
    ['errFullName', 'errPosition', 'errDailyRate'].forEach(id => {
        document.getElementById(id).textContent = '';
    });
}

// ── Modal close helpers ────────────────────────────────────
function closeModal()           { document.getElementById('employeeModal').classList.remove('open'); }
function closeDeactivateModal() { document.getElementById('deactivateModal').classList.remove('open'); }

// ── Close on backdrop click or Escape key ──────────────────
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) {
        closeModal();
        closeDeactivateModal();
    }
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDeactivateModal(); }
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
    loadEmployees();
});
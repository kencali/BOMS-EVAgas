// ============================================================
// FILE: assets/js/admin/payroll.js
// PLACE IN: /assets/js/admin/payroll.js
//
// HTML IDs this file reads/writes (verified against payroll.html):
//   periodStart, periodEnd, daysWorkedInput,
//   payrollTableBody, payrollCount,
//   totalGross, totalDeductions, totalNet,
//   viewingBadge,
//   editModal, editEmployeeName, editDaysWorked,
//   editDeductions, editGrossDisplay, editNetDisplay,
//   errEditDays, errEditDeductions, confirmEditBtn,
//   toast
//
// API calls (verified against api/payroll/index.php):
//   GET    payroll/index.php?branch_id=N&period_start=Y-m-d&period_end=Y-m-d
//   POST   payroll/index.php                        → compute batch
//   PUT    payroll/index.php?id=N                   → edit deductions
//   PUT    payroll/index.php?action=release&id=N    → release one
//   PUT    payroll/index.php?action=release_all     → release all draft
//   DELETE payroll/index.php?id=N                   → delete draft
// ============================================================

Auth.guard(['admin']);

// ── Module-level state ─────────────────────────────────────
const currentUser  = Auth.getUser();
let   viewBranch   = currentUser.branch_id;
let   allRecords   = [];    // local cache
let   editingId    = null;  // payroll record ID being edited
let   editDailyRate = 0;    // daily rate of employee being edited

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

// ── Default period to current month ───────────────────────
function setDefaultPeriod() {
    const now        = new Date();
    const firstDay   = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay    = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt        = d => d.toISOString().split('T')[0];

    document.getElementById('periodStart').value = fmt(firstDay);
    document.getElementById('periodEnd').value   = fmt(lastDay);
}

// ── Load payroll records for selected period ───────────────
async function loadPayroll() {
    document.getElementById('payrollTableBody').innerHTML =
        `<tr><td colspan="8" class="table-empty">Loading...</td></tr>`;

    const periodStart = document.getElementById('periodStart').value;
    const periodEnd   = document.getElementById('periodEnd').value;

    if (!periodStart || !periodEnd) {
        showToast('Please select a period.', 'error');
        return;
    }

    try {
        const params = new URLSearchParams({
            branch_id:    viewBranch,
            period_start: periodStart,
            period_end:   periodEnd,
        });
        const data = await Api.get(`payroll/index.php?${params.toString()}`);

        allRecords = data.records;

        // Update totals — IDs: totalGross, totalDeductions, totalNet
        document.getElementById('totalGross').textContent      = peso(data.totals.total_gross);
        document.getElementById('totalDeductions').textContent = peso(data.totals.total_deductions);
        document.getElementById('totalNet').textContent        = peso(data.totals.total_net);
        document.getElementById('payrollCount').textContent    =
            `${data.count} employee${data.count !== 1 ? 's' : ''}`;

        renderTable(allRecords);

    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('payrollTableBody').innerHTML =
            `<tr><td colspan="8" class="table-empty" style="color:var(--red);">Failed to load payroll.</td></tr>`;
    }
}

// ── Render table rows ──────────────────────────────────────
function renderTable(records) {
    const tbody  = document.getElementById('payrollTableBody');
    const isOwn  = viewBranch === currentUser.branch_id;

    if (!records.length) {
        tbody.innerHTML =
            `<tr><td colspan="8" class="table-empty">
                No payroll records for this period.<br/>
                <small>Click "Compute Payroll" to generate records for all active employees.</small>
             </td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => {
        const isDraft    = r.status === 'Draft';
        const statusCls  = isDraft ? 'status-draft' : 'status-released';

        // Action buttons — only shown on own branch and Draft records
        const actions = isOwn ? `
            ${isDraft
                ? `<button class="btn-action edit-pay"
                           onclick="openEditModal(${r.id}, '${escHtml(r.employee_name)}', ${r.days_worked}, ${r.deductions}, ${r.daily_rate})">
                       Edit
                   </button>
                   <button class="btn-action release-one"
                           onclick="releaseOne(${r.id})">
                       Release
                   </button>
                   <button class="btn-action del-pay"
                           onclick="deleteRecord(${r.id})">
                       Delete
                   </button>`
                : '<span style="color:var(--mist);font-size:.75rem;">Released</span>'
            }` : '<span style="color:var(--mist);font-size:.75rem;">Read-only</span>';

        return `
            <tr>
                <td>
                    <div class="emp-name">${escHtml(r.employee_name)}</div>
                    <div class="emp-pos">${escHtml(r.employee_position)}</div>
                </td>
                <td class="mono">${r.days_worked}</td>
                <td class="mono">₱${Number(r.daily_rate).toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
                <td class="mono green">${peso(r.gross_pay)}</td>
                <td class="mono red">${peso(r.deductions)}</td>
                <td class="mono white">${peso(r.net_pay)}</td>
                <td><span class="status-badge ${statusCls}">${r.status}</span></td>
                <td class="col-actions">${actions}</td>
            </tr>`;
    }).join('');
}

// ── Compute payroll batch ──────────────────────────────────
async function computePayroll() {
    const periodStart = document.getElementById('periodStart').value;
    const periodEnd   = document.getElementById('periodEnd').value;
    const daysWorked  = parseFloat(document.getElementById('daysWorkedInput').value);

    if (!periodStart || !periodEnd) {
        showToast('Please select a period first.', 'error');
        return;
    }
    if (!daysWorked || daysWorked <= 0) {
        showToast('Enter the number of days worked.', 'error');
        return;
    }

    const btn = document.getElementById('computeBtn');
    btn.disabled    = true;
    btn.textContent = 'Computing...';

    try {
        const data = await Api.post('payroll/index.php', {
            period_start: periodStart,
            period_end:   periodEnd,
            days_worked:  daysWorked,
        });
        showToast(data.message, 'success');
        loadPayroll();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Compute Payroll';
    }
}

// ── Release all draft records for this period ──────────────
async function releaseAll() {
    const periodStart = document.getElementById('periodStart').value;
    const periodEnd   = document.getElementById('periodEnd').value;

    const draftCount = allRecords.filter(r => r.status === 'Draft').length;
    if (!draftCount) {
        showToast('No Draft records to release.', 'error');
        return;
    }

    const btn = document.getElementById('releaseAllBtn');
    btn.disabled    = true;
    btn.textContent = 'Releasing...';

    try {
        const data = await Api.put('payroll/index.php?action=release_all', {
            period_start: periodStart,
            period_end:   periodEnd,
        });
        showToast(`${data.released} record(s) released.`, 'success');
        loadPayroll();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = '✓ Release All';
    }
}

// ── Release single record ──────────────────────────────────
async function releaseOne(payrollId) {
    try {
        await Api.put(`payroll/index.php?action=release&id=${payrollId}`, {});
        showToast('Record released.', 'success');
        loadPayroll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Delete single draft record ─────────────────────────────
async function deleteRecord(payrollId) {
    try {
        await Api.delete(`payroll/index.php?id=${payrollId}`);
        showToast('Record deleted.', 'success');
        loadPayroll();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Open edit modal ────────────────────────────────────────
function openEditModal(id, empName, daysWorked, deductions, dailyRate) {
    editingId    = id;
    editDailyRate = dailyRate;

    document.getElementById('editEmployeeName').textContent = empName;
    document.getElementById('editDaysWorked').value         = daysWorked;
    document.getElementById('editDeductions').value         = deductions;
    document.getElementById('errEditDays').textContent      = '';
    document.getElementById('errEditDeductions').textContent= '';
    document.getElementById('editDaysWorked').classList.remove('error');
    document.getElementById('editDeductions').classList.remove('error');

    updateEditPreview(); // show current gross/net
    document.getElementById('editModal').classList.add('open');
}

// ── Live preview of gross/net as admin types ───────────────
function updateEditPreview() {
    const days       = parseFloat(document.getElementById('editDaysWorked').value)  || 0;
    const deductions = parseFloat(document.getElementById('editDeductions').value)  || 0;
    const gross      = Math.round(days * editDailyRate * 100) / 100;
    const net        = Math.max(0, Math.round((gross - deductions) * 100) / 100);

    // IDs: editGrossDisplay, editNetDisplay
    document.getElementById('editGrossDisplay').textContent = peso(gross);
    document.getElementById('editNetDisplay').textContent   = peso(net);
}

// ── Submit edit ────────────────────────────────────────────
async function handleEdit() {
    document.getElementById('errEditDays').textContent       = '';
    document.getElementById('errEditDeductions').textContent = '';
    document.getElementById('editDaysWorked').classList.remove('error');
    document.getElementById('editDeductions').classList.remove('error');

    const daysWorked  = parseFloat(document.getElementById('editDaysWorked').value);
    const deductions  = parseFloat(document.getElementById('editDeductions').value) || 0;

    let valid = true;
    if (!daysWorked || daysWorked <= 0) {
        document.getElementById('editDaysWorked').classList.add('error');
        document.getElementById('errEditDays').textContent = 'Days worked must be greater than zero.';
        valid = false;
    }
    if (deductions < 0) {
        document.getElementById('editDeductions').classList.add('error');
        document.getElementById('errEditDeductions').textContent = 'Deductions cannot be negative.';
        valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('confirmEditBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    try {
        await Api.put(`payroll/index.php?id=${editingId}`, {
            days_worked: daysWorked,
            deductions:  deductions,
        });
        showToast('Payroll record updated.', 'success');
        closeEditModal();
        loadPayroll();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Save Changes';
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

    // Hide compute/release buttons when viewing other branch
    ['computeBtn','releaseAllBtn'].forEach(id => {
        document.getElementById(id).style.display = isOwn ? 'inline-flex' : 'none';
    });

    loadPayroll();
}

// ── Modal helpers ──────────────────────────────────────────
function closeEditModal() {
    document.getElementById('editModal').classList.remove('open');
}

document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) closeEditModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditModal();
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
    setDefaultPeriod();
    loadPayroll();
});
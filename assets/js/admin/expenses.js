// ============================================================
// FILE: assets/js/admin/expenses.js
// PLACE IN: /assets/js/admin/expenses.js
//
// HTML IDs this file reads/writes (verified against expenses.html):
//   expenseTableBody, expenseCount, totalExpenses,
//   viewingBadge, dateFrom, dateTo,
//   categoryBreakdown,
//   expenseModal, modalTitle, submitBtn,
//   fieldCategory, fieldDescription, fieldAmount, fieldExpenseDate,
//   errDescription, errAmount,
//   deleteModal, deleteExpenseDesc, confirmDeleteBtn,
//   toast
//
// API calls (verified against api/expenses/index.php):
//   GET    expenses/index.php?branch_id=N&date_from=Y-m-d&date_to=Y-m-d
//   POST   expenses/index.php
//   PUT    expenses/index.php?id=N
//   DELETE expenses/index.php?id=N
// ============================================================

Auth.guard(['admin']);

// ── Module-level state ─────────────────────────────────────
const currentUser  = Auth.getUser();
let   viewBranch   = currentUser.branch_id;
let   editingId    = null;
let   allExpenses  = [];

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
    const fmt      = d => d.toISOString().split('T')[0];
    document.getElementById('dateFrom').value = fmt(firstDay);
    document.getElementById('dateTo').value   = fmt(now);
    document.querySelectorAll('#dateFrom, #dateTo')
        .forEach(input => input.dispatchEvent(new Event('change')));
}

// ── Load expenses ──────────────────────────────────────────
async function loadExpenses() {
    document.getElementById('expenseTableBody').innerHTML =
        `<tr><td colspan="6" class="table-empty">Loading...</td></tr>`;

    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo   = document.getElementById('dateTo').value;

    try {
        const params = new URLSearchParams({
            branch_id: viewBranch,
            date_from: dateFrom,
            date_to:   dateTo,
        });
        const data = await Api.get(`expenses/index.php?${params.toString()}`);

        allExpenses = data.expenses;

        // Update summary — IDs: totalExpenses, expenseCount
        document.getElementById('totalExpenses').textContent = peso(data.total);
        document.getElementById('expenseCount').textContent  =
            `${data.count} record${data.count !== 1 ? 's' : ''}`;

        renderTable(allExpenses);
        renderCategoryBreakdown(data.by_category);

    } catch (err) {
        showToast(err.message, 'error');
        document.getElementById('expenseTableBody').innerHTML =
            `<tr><td colspan="6" class="table-empty" style="color:var(--red);">Failed to load expenses.</td></tr>`;
    }
}

// ── Render expense table ───────────────────────────────────
function renderTable(expenses) {
    const tbody = document.getElementById('expenseTableBody');
    const isOwn = viewBranch === currentUser.branch_id;

    if (!expenses.length) {
        tbody.innerHTML =
            `<tr><td colspan="6" class="table-empty">No expenses found for this period.</td></tr>`;
        return;
    }

    tbody.innerHTML = expenses.map(e => {
        const dateStr = new Date(e.expense_date).toLocaleDateString('en-PH', {
            year: 'numeric', month: 'short', day: 'numeric'
        });

        return `
            <tr>
                <td>${dateStr}</td>
                <td><span class="cat-badge cat-${slugify(e.category)}">${escHtml(e.category)}</span></td>
                <td class="exp-desc">${escHtml(e.description)}</td>
                <td class="mono red">${peso(e.amount)}</td>
                <td style="font-size:.78rem;color:var(--mist);">${escHtml(e.created_by_name || '—')}</td>
                <td class="col-actions">
                    ${isOwn ? `
                        <button class="btn-action edit"
                                onclick="openEditModal(${e.id})">Edit</button>
                        <button class="btn-action del"
                                onclick="confirmDelete(${e.id}, '${escHtml(e.description)}')">Delete</button>
                    ` : '<span style="color:var(--mist);font-size:.75rem;">Read-only</span>'}
                </td>
            </tr>`;
    }).join('');
}

// ── Render category breakdown sidebar ─────────────────────
function renderCategoryBreakdown(byCategory) {
    const el = document.getElementById('categoryBreakdown');
    if (!byCategory.length) {
        el.innerHTML = '<div style="color:var(--mist);font-size:.82rem;">No data yet.</div>';
        return;
    }
    const total = byCategory.reduce((s, c) => s + parseFloat(c.subtotal), 0);
    el.innerHTML = byCategory.map(c => {
        const pct = total > 0 ? Math.round((parseFloat(c.subtotal) / total) * 100) : 0;
        return `
            <div class="cat-row">
                <div class="cat-row-top">
                    <span class="cat-badge cat-${slugify(c.category)}">${escHtml(c.category)}</span>
                    <span class="cat-amount">${peso(c.subtotal)}</span>
                </div>
                <div class="cat-bar-track">
                    <div class="cat-bar-fill" style="width:${pct}%"></div>
                </div>
                <div class="cat-pct">${pct}%</div>
            </div>`;
    }).join('');
}

// ── Simple slugify for CSS class (no special chars) ───────
function slugify(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// ── Open modal: ADD ────────────────────────────────────────
function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent  = 'Add Expense';
    document.getElementById('submitBtn').textContent   = 'Add Expense';
    document.getElementById('expenseModal').querySelector('form').reset();
    document.getElementById('fieldExpenseDate').value  =
        new Date().toISOString().split('T')[0]; // default to today
    document.getElementById('fieldExpenseDate').dispatchEvent(new Event('change'));
    clearFieldErrors();
    document.getElementById('expenseModal').classList.add('open');
}

// ── Open modal: EDIT ───────────────────────────────────────
function openEditModal(id) {
    const expense = allExpenses.find(e => e.id === id);
    if (!expense) return showToast('Expense not found.', 'error');

    editingId = id;
    document.getElementById('modalTitle').textContent    = 'Edit Expense';
    document.getElementById('submitBtn').textContent     = 'Save Changes';
    clearFieldErrors();

    // Pre-fill — IDs match HTML inputs exactly
    document.getElementById('fieldCategory').value    = expense.category;
    document.getElementById('fieldDescription').value = expense.description;
    document.getElementById('fieldAmount').value      = expense.amount;
    document.getElementById('fieldExpenseDate').value = expense.expense_date;
    document.getElementById('fieldExpenseDate').dispatchEvent(new Event('change'));

    document.getElementById('expenseModal').classList.add('open');
}

// ── Submit (add or edit) ───────────────────────────────────
async function handleSubmit() {
    clearFieldErrors();

    const body = {
        category:     document.getElementById('fieldCategory').value,
        description:  document.getElementById('fieldDescription').value.trim(),
        amount:       parseFloat(document.getElementById('fieldAmount').value) || 0,
        expense_date: document.getElementById('fieldExpenseDate').value,
    };

    let valid = true;
    if (!body.description) {
        setFieldError('fieldDescription', 'errDescription', 'Description is required.');
        valid = false;
    }
    if (!body.amount || body.amount <= 0) {
        setFieldError('fieldAmount', 'errAmount', 'Amount must be greater than zero.');
        valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('submitBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    try {
        if (editingId) {
            await Api.put(`expenses/index.php?id=${editingId}`, body);
            showToast('Expense updated.', 'success');
        } else {
            await Api.post('expenses/index.php', body);
            showToast('Expense added.', 'success');
        }
        closeModal();
        loadExpenses();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = editingId ? 'Save Changes' : 'Add Expense';
    }
}

// ── Delete confirmation ────────────────────────────────────
function confirmDelete(id, description) {
    document.getElementById('deleteExpenseDesc').textContent = description;
    document.getElementById('deleteModal').dataset.id        = id;
    document.getElementById('deleteModal').classList.add('open');
}

async function executeDelete() {
    const id  = parseInt(document.getElementById('deleteModal').dataset.id);
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled    = true;
    btn.textContent = 'Deleting...';

    try {
        await Api.delete(`expenses/index.php?id=${id}`);
        showToast('Expense deleted.', 'success');
        closeDeleteModal();
        loadExpenses();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Yes, Delete';
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
    document.getElementById('addExpenseBtn').style.display = isOwn ? 'flex' : 'none';
    loadExpenses();
}

// ── Field error helpers ────────────────────────────────────
function setFieldError(inputId, errorId, message) {
    document.getElementById(inputId).classList.add('error');
    document.getElementById(errorId).textContent = message;
}
function clearFieldErrors() {
    ['fieldDescription','fieldAmount'].forEach(id =>
        document.getElementById(id).classList.remove('error'));
    ['errDescription','errAmount'].forEach(id =>
        { document.getElementById(id).textContent = ''; });
}

// ── Modal helpers ──────────────────────────────────────────
function closeModal()       { document.getElementById('expenseModal').classList.remove('open'); }
function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('open'); }

document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) {
        closeModal(); closeDeleteModal();
    }
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDeleteModal(); }
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
    setDefaultDates();
    loadExpenses();
});

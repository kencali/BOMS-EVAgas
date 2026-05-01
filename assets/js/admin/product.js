// ============================================================
// FILE: assets/js/admin/products.js
// PURPOSE: Everything products — list, add, edit, delete.
//          Replaces: products.php, add_product.php,
//                    edit_product.php, delete_product.php
//
//  No page reloads. Everything happens in one page with a modal.
// ============================================================

Auth.guard(['admin']);

// ── State ─────────────────────────────────────────────────
const currentUser  = Auth.getUser();
let   allProducts  = [];      // cache of loaded products
let   editingId    = null;    // null = adding, number = editing
let   viewBranch   = currentUser.branch_id;
let   searchTimer  = null;    // debounce timer for search

// ── Currency formatter ─────────────────────────────────────
const peso = v => '₱' + Number(v).toLocaleString('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
});

// ── Load products from API ─────────────────────────────────
async function loadProducts() {
    setTableLoading(true);
    try {
        const search = document.getElementById('searchInput').value.trim();
        const status = document.getElementById('statusFilter').value;

        const params = new URLSearchParams({
            branch_id: viewBranch,
            status,
            ...(search ? { search } : {})
        });

        const data = await Api.get(`products/index.php?${params}`);
        allProducts = data.products;
        renderTable(allProducts);
        document.getElementById('productCount').textContent =
            `${data.count} product${data.count !== 1 ? 's' : ''}`;

    } catch (err) {
        showToast(err.message, 'error');
        renderTableError();
    } 
}

// ── Render product table rows ──────────────────────────────
function renderTable(products) {
    const tbody = document.getElementById('productTableBody');

    if (!products.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty">
                    No products found.
                    <br><small>Try a different search or add a new product.</small>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = products.map(p => `
        <tr data-id="${p.id}">
            <td class="col-id">#${p.id}</td>
            <td class="col-name">
                <div class="product-name">${escHtml(p.product_name)}</div>
                <div class="product-cat">${escHtml(p.category)}</div>
            </td>
            <td class="col-price mono">${peso(p.price)}</td>
            <td class="col-stock">
                <span class="stock-pill ${stockClass(p.stock)}">
                    ${p.stock} units
                </span>
            </td>
            <td class="col-status">
                <span class="status-badge ${p.status === 'Active' ? 'active' : 'inactive'}">
                    ${p.status}
                </span>
            </td>
            <td class="col-actions">
                <button class="btn-action edit"   onclick="openEditModal(${p.id})">Edit</button>
                <button class="btn-action delete" onclick="confirmDelete(${p.id}, '${escHtml(p.product_name)}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function stockClass(stock) {
    if (stock <= 0)  return 'out';
    if (stock <= 5)  return 'low';
    if (stock <= 20) return 'mid';
    return 'good';
}

function setTableLoading(on) {
    document.getElementById('productTableBody').innerHTML = on
        ? `<tr><td colspan="6" class="table-empty">Loading...</td></tr>` : '';
}

function renderTableError() {
    document.getElementById('productTableBody').innerHTML =
        `<tr><td colspan="6" class="table-empty" style="color:var(--red)">
            Failed to load products. Check your connection.
        </td></tr>`;
}

// ── Modal: open for ADD ────────────────────────────────────
function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent  = 'Add New Product';
    document.getElementById('submitBtn').textContent   = 'Add Product';
    document.getElementById('productForm').reset();
    document.getElementById('statusRow').style.display = 'none'; // hide status on add
    clearFormErrors();
    openModal();
}

// ── Modal: open for EDIT ───────────────────────────────────
async function openEditModal(id) {
    editingId = id;
    document.getElementById('modalTitle').textContent  = 'Edit Product';
    document.getElementById('submitBtn').textContent   = 'Save Changes';
    document.getElementById('statusRow').style.display = 'flex';
    clearFormErrors();

    // Pre-fill with cached data (no extra API call needed)
    const product = allProducts.find(p => p.id === id);
    if (!product) return showToast('Product not found.', 'error');

    document.getElementById('productName').value     = product.product_name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value    = product.price;
    document.getElementById('productStock').value    = product.stock;
    document.getElementById('productStatus').value   = product.status;

    openModal();
}

// ── Modal: submit (handles both add and edit) ──────────────
async function handleSubmit() {
    clearFormErrors();

    const body = {
        product_name: document.getElementById('productName').value.trim(),
        category:     document.getElementById('productCategory').value.trim() || 'General',
        price:        parseFloat(document.getElementById('productPrice').value),
        stock:        parseInt(document.getElementById('productStock').value),
        status:       document.getElementById('productStatus').value,
    };

    // Client-side validation (mirrors server validation)
    let valid = true;
    if (!body.product_name) { setFieldError('productName', 'Name is required.');    valid = false; }
    if (!body.price || body.price <= 0) { setFieldError('productPrice', 'Enter a valid price.'); valid = false; }
    if (isNaN(body.stock) || body.stock < 0) { setFieldError('productStock', 'Stock cannot be negative.'); valid = false; }
    if (!valid) return;

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        if (editingId) {
            // Update
            await Api.put(`products/index.php?id=${editingId}`, body);
            showToast('Product updated successfully.', 'success');
        } else {
            // Create
            await Api.post('products/index.php', body);
            showToast('Product added successfully.', 'success');
        }
        closeModal();
        loadProducts(); // refresh table

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editingId ? 'Save Changes' : 'Add Product';
    }
}

// ── Delete with confirmation ───────────────────────────────
function confirmDelete(id, name) {
    document.getElementById('deleteProductName').textContent = name;
    document.getElementById('deleteModal').dataset.id = id;
    document.getElementById('deleteModal').classList.add('open');
}

async function executeDelete() {
    const id  = parseInt(document.getElementById('deleteModal').dataset.id);
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
        await Api.delete(`products/index.php?id=${id}`);
        showToast('Product removed.', 'success');
        closeDeleteModal();
        loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Yes, Remove';
    }
}

// ── Modal helpers ──────────────────────────────────────────
function openModal()        { document.getElementById('productModal').classList.add('open'); }
function closeModal()       { document.getElementById('productModal').classList.remove('open'); }
function closeDeleteModal() { document.getElementById('deleteModal').classList.remove('open'); }

function clearFormErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.field-input.error').forEach(el => el.classList.remove('error'));
}

function setFieldError(fieldId, msg) {
    document.getElementById(fieldId).classList.add('error');
    const err = document.getElementById(fieldId + 'Error');
    if (err) err.textContent = msg;
}

// ── Branch toggle ──────────────────────────────────────────
function switchBranch(branchId) {
    viewBranch = branchId;
    document.querySelectorAll('.branch-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.branch) === branchId);
    });

    // Disable add/edit/delete if viewing other branch (read-only)
    const isOwn = branchId === currentUser.branch_id;
    document.getElementById('addProductBtn').style.display = isOwn ? 'flex' : 'none';

    const badge = document.getElementById('viewingBadge');
    badge.textContent = isOwn
        ? `Branch ${branchId === 1 ? 'A' : 'B'} (your branch)`
        : `Branch ${branchId === 1 ? 'A' : 'B'} (read-only)`;
    badge.className = `branch-view-badge ${isOwn ? 'own' : 'other'}`;

    loadProducts();
}

// ── Search with debounce (waits 400ms after typing stops) ──
function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadProducts, 400);
}

// ── Toast ──────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// ── XSS safety — escape HTML before inserting into DOM ────
function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Close modals on backdrop click ────────────────────────
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) {
        closeModal();
        closeDeleteModal();
    }
});

// ── Close modals on Escape key ─────────────────────────────
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
    loadProducts();
});
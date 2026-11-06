// ── Guard: deliverer only ──────────────────────────────────
Auth.guard(['deliverer']);

// ── State ──────────────────────────────────────────────────
let allDeliveries  = [];
let activeFilter   = 'all';

// ── Load deliveries ────────────────────────────────────────
async function loadDeliveries() {
    document.getElementById('deliveryCards').innerHTML =
        `<div class="empty-state"><div class="empty-icon">${BomsIcons.icon('package')}</div><div>Loading...</div></div>`;
    try {
        // API automatically filters to only this deliverer's assignments
        // (enforced server-side in api/deliveries/index.php)
        const data     = await Api.get('deliveries/index.php');
        allDeliveries  = data.deliveries;
        renderCards(allDeliveries);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Filter tabs ────────────────────────────────────────────
function filterByStatus(status) {
    activeFilter = status;
    document.querySelectorAll('.status-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.status === status);
    });
    const filtered = status === 'all'
        ? allDeliveries
        : allDeliveries.filter(d => d.delivery_status === status);
    renderCards(filtered);
}

// ── Render delivery cards ──────────────────────────────────
function renderCards(deliveries) {
    const container = document.getElementById('deliveryCards');

    if (!deliveries.length) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">${BomsIcons.icon('package')}</div>
                <div>No ${activeFilter === 'all' ? '' : activeFilter.toLowerCase()} deliveries.</div>
            </div>`;
        return;
    }

    container.innerHTML = deliveries.map(d => {
        const statusClass = {
            'Pending'    : 'status-pending',
            'On the way' : 'status-otw',
            'Delivered'  : 'status-delivered',
            'Cancelled'  : 'status-cancelled',
        }[d.delivery_status] ?? 'status-pending';

        const cardClass = statusClass;

        const dateStr = new Date(d.created_at).toLocaleDateString('en-PH', {
            month: 'short', day: 'numeric', year: 'numeric'
        });

        // Which action buttons to show based on current status
        const canMarkOtw       = d.delivery_status === 'Pending';
        const canMarkDelivered = d.delivery_status === 'On the way';

        const actionButtons = (canMarkOtw || canMarkDelivered) ? `
            <div class="status-actions">
                ${canMarkOtw ? `
                    <button class="btn-status btn-otw"
                            onclick="updateStatus(${d.id}, 'On the way', this)">
                        ${BomsIcons.icon('play')} Start Delivery
                    </button>` : ''}
                ${canMarkDelivered ? `
                    <button class="btn-status btn-delivered"
                            onclick="updateStatus(${d.id}, 'Delivered', this)">
                        ${BomsIcons.icon('check')} Mark Delivered
                    </button>` : ''}
            </div>` : '';

        const notesHtml = d.notes
            ? `<div class="card-notes">${BomsIcons.icon('receipt')} ${escHtml(d.notes)}</div>` : '';

        return `
            <div class="delivery-card ${cardClass}" id="dcard-${d.id}">
                <div class="card-top">
                    <div>
                        <div class="card-id">Delivery #${d.id} · ${dateStr}</div>
                        <div class="card-customer">${escHtml(d.customer_name)}</div>
                        <div class="card-phone">${escHtml(d.customer_phone || '—')}</div>
                    </div>
                    <span class="status-badge ${statusClass}">${escHtml(d.delivery_status)}</span>
                </div>

                <div class="card-info">
                    <div class="info-item full">
                        <div class="info-label">Address</div>
                        <div class="info-val">${escHtml(d.customer_address)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Product</div>
                        <div class="info-val">${escHtml(d.product_name)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Quantity</div>
                        <div class="info-val">${d.quantity} unit${d.quantity !== 1 ? 's' : ''}</div>
                    </div>
                </div>

                ${notesHtml}
                ${actionButtons}
            </div>`;
    }).join('');
}

// ── Update delivery status ─────────────────────────────────
// Uses: PUT /api/deliveries/index.php?id=N&action=status
async function updateStatus(deliveryId, newStatus, buttonEl) {
    buttonEl.disabled    = true;
    buttonEl.textContent = 'Updating...';

    try {
        await Api.put(
            `deliveries/index.php?id=${deliveryId}&action=status`,
            { delivery_status: newStatus }
        );

        showToast(
            newStatus === 'Delivered'
                ? 'Marked as delivered!'
                : 'Delivery started!',
            'success'
        );

        // Update local cache and re-render without a full reload
        const idx = allDeliveries.findIndex(d => d.id === deliveryId);
        if (idx !== -1) allDeliveries[idx].delivery_status = newStatus;
        filterByStatus(activeFilter);

    } catch (err) {
        showToast(err.message, 'error');
        buttonEl.disabled    = false;
        buttonEl.innerHTML = newStatus === 'Delivered' ? `${BomsIcons.icon('check')} Mark Delivered` : `${BomsIcons.icon('play')} Start Delivery`;
    }
}

// ── Toast ──────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.className   = `toast show ${type}`;
    setTimeout(() => el.classList.remove('show'), 4500);
}

function escHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    document.getElementById('deliveryDate').textContent =
        new Date().toLocaleDateString('en-PH', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    loadDeliveries();
});

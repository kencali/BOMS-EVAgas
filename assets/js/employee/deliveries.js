Auth.guard(['employee']);

const currentUser = Auth.getUser();

function escHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove('show'), 4000);
}

function statusClass(status) {
    return {
        'Pending': 'status-pending',
        'On the way': 'status-otw',
        'Delivered': 'status-delivered',
        'Cancelled': 'status-cancelled',
    }[status] || 'status-cancelled';
}

function formatDate(value) {
    return new Date(value).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function renderDeliveries(deliveries) {
    const tbody = document.getElementById('deliveryTableBody');
    document.getElementById('deliveryCount').textContent =
        `${deliveries.length} ${deliveries.length === 1 ? 'delivery' : 'deliveries'}`;

    if (!deliveries.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No deliveries found for your branch.</td></tr>';
        return;
    }

    tbody.innerHTML = deliveries.map(delivery => `
        <tr>
          <td><div class="customer-name">${escHtml(delivery.customer_name)}</div><div class="address">${escHtml(delivery.customer_phone || 'No phone')}<br>${escHtml(delivery.customer_address)}</div></td>
          <td><div class="product">${escHtml(delivery.product_name)} × ${delivery.quantity}</div></td>
          <td class="${delivery.assigned_name ? 'assigned' : 'unassigned'}">${escHtml(delivery.assigned_name || 'Unassigned')}</td>
          <td><span class="status-badge ${statusClass(delivery.delivery_status)}">${escHtml(delivery.delivery_status)}</span></td>
          <td>${delivery.notes ? `<div class="notes">${escHtml(delivery.notes)}</div>` : ''}<div class="date">Created ${formatDate(delivery.created_at)}</div>${delivery.delivered_at ? `<div class="date">Delivered ${formatDate(delivery.delivered_at)}</div>` : ''}</td>
        </tr>`).join('');
}

async function loadDeliveries() {
    const tbody = document.getElementById('deliveryTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading deliveries...</td></tr>';

    try {
        const status = document.getElementById('statusFilter').value;
        const params = new URLSearchParams({ branch_id: currentUser.branch_id });
        if (status !== 'all') params.set('status', status);
        const data = await Api.get(`deliveries/index.php?${params.toString()}`);
        renderDeliveries(data.deliveries);
    } catch (error) {
        showToast(error.message, 'error');
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Unable to load deliveries.</td></tr>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    document.getElementById('branchLabel').textContent =
        `Branch ${currentUser.branch_id === 1 ? 'A · Malilipot' : 'B · Legazpi'} deliveries`;
    loadDeliveries();
});

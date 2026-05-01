Auth.guard(['employee']);

const peso = v => '₱' + Number(v).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});

function setGreeting() {
    const h = new Date().getHours();
    const name = Auth.getUser().name?.split(' ')[0] || 'there';
    document.getElementById('greeting').textContent =
        (h < 12 ? '🌅 Good morning' : h < 17 ? '☀️ Good afternoon' : '🌙 Good evening') + `, ${name}`;
    document.getElementById('dateLabel').textContent =
        new Date().toLocaleDateString('en-PH',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

async function loadTodaySales() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const data  = await Api.get(`sales/index.php?date_from=${today}&date_to=${today}`);

        document.getElementById('todaySales').textContent  = peso(data.total);
        document.getElementById('todayCount').textContent  = data.count;

        const tbody = document.getElementById('recentSalesBody');
        if (!data.sales.length) {
            tbody.innerHTML = '<tr><td class="empty-row" colspan="4">No sales yet today.</td></tr>';
            return;
        }
        tbody.innerHTML = data.sales.slice(0,8).map(s => `
            <tr>
                <td>${new Date(s.sale_date).toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'})}</td>
                <td class="mono">${peso(s.total_amount)}</td>
                <td class="mono">${peso(s.amount_tendered)}</td>
                <td class="mono">${peso(s.change_amount)}</td>
            </tr>`).join('');
    } catch(e) {
        console.error(e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    setGreeting();
    loadTodaySales();
});
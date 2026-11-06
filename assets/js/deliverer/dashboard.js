Auth.guard(['deliverer']);

async function loadStats() {
    try {
        const data = await Api.get('deliveries/index.php');

        const counts = data.counts;
        document.getElementById('statPending').textContent = counts['Pending']    ?? 0;
        document.getElementById('statOtw').textContent     = counts['On the way'] ?? 0;
        document.getElementById('statDone').textContent    = counts['Delivered']  ?? 0;
    } catch(e) {
        console.error(e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    const user = Auth.getUser();
    const h    = new Date().getHours();
    const name = user.name?.split(' ')[0] || 'there';
    document.getElementById('greeting').textContent =
        (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + `, ${name}`;
    document.getElementById('dateLabel').textContent =
        new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    loadStats();
});

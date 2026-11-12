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

async function loadRouteOverview() {
    const summary = document.getElementById('dashboardRouteSummary');
    const empty = document.getElementById('dashboardRouteEmpty');
    const mapElement = document.getElementById('dashboardRouteMap');
    const stops = document.getElementById('dashboardRouteStops');
    const routeMap = BomsRiderRouteMap.create('dashboardRouteMap');
    window.addEventListener('resize', routeMap.resize);

    try {
        const data = await Api.get('routes/index.php?mine=1');
        if (!data.route) {
            summary.textContent = 'No planned route is assigned to you.';
            empty.hidden = false;
            mapElement.hidden = true;
            return;
        }
        routeMap.render(data.route);
        summary.textContent = BomsRiderRouteMap.summary(data.route);
        stops.innerHTML = BomsRiderRouteMap.sequence(data.route);
    } catch (error) {
        summary.textContent = 'Route overview could not be loaded.';
        empty.textContent = error.message || 'Route overview could not be loaded.';
        empty.hidden = false;
        mapElement.hidden = true;
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
    loadRouteOverview();
});

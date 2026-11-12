Auth.guard(['deliverer']);

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar();
    const map = BomsRiderRouteMap.create('routeMap');
    window.addEventListener('resize', map.resize);

    try {
        const data = await Api.get('routes/index.php?mine=1');
        if (!data.route) {
            document.getElementById('routeSummary').textContent = 'No planned route is assigned to you.';
            return;
        }

        map.render(data.route);
        document.getElementById('routeSummary').textContent = BomsRiderRouteMap.summary(data.route);
        document.getElementById('routeSequence').innerHTML = BomsRiderRouteMap.sequence(data.route);
    } catch (error) {
        document.getElementById('routeSummary').textContent = error.message || 'Route could not be loaded.';
    }
});

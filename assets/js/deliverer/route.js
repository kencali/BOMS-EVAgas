Auth.guard(['deliverer']);

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

function routeIcon(label, kind = 'stop') {
    return L.divIcon({
        className: `boms-route-marker boms-route-marker-${kind}`,
        html: `<span>${esc(label)}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar();

    const map = L.map('routeMap').setView([13.3199218, 123.7398304], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const resizeMap = () => requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    window.addEventListener('resize', resizeMap);
    resizeMap();

    try {
        const data = await Api.get('routes/index.php?mine=1');
        const route = data.route;
        if (!route) {
            document.getElementById('routeSummary').textContent = 'No planned route is assigned to you.';
            return;
        }

        const routeLayer = L.layerGroup().addTo(map);
        const start = route.start || { name: 'Branch start', latitude: 13.3199218, longitude: 123.7398304 };
        const startPoint = [+start.latitude, +start.longitude];
        const points = [startPoint];

        L.marker(startPoint, { icon: routeIcon('S', 'start'), zIndexOffset: 1100 })
            .addTo(routeLayer)
            .bindPopup(esc(start.name));

        route.stops.forEach((stop, index) => {
            const point = [+stop.latitude, +stop.longitude];
            points.push(point);
            L.marker(point, { icon: routeIcon(index + 1), zIndexOffset: 1000 })
                .addTo(routeLayer)
                .bindPopup(`${index + 1}. ${esc(stop.customer_name)}<br>${esc(stop.customer_address)}`);
        });

        if (route.geometry?.coordinates?.length) {
            const line = route.geometry.coordinates.map(point => [point[1], point[0]]);
            L.polyline(line, { color: '#e84a1b', weight: 5, opacity: .9 }).addTo(routeLayer);
            map.fitBounds(line, { padding: [34, 34] });
        } else if (points.length) {
            map.fitBounds(points, { padding: [34, 34] });
        }

        document.getElementById('routeSummary').textContent = `${(route.total_distance_m / 1000).toFixed(1)} km · about ${Math.round(route.total_duration_s / 60)} minutes`;
        document.getElementById('routeSequence').innerHTML = route.stops.map((stop, index) => `<li><strong>${index + 1}. ${esc(stop.customer_name)}</strong> — ${esc(stop.customer_address)} (${esc(stop.delivery_status)})</li>`).join('');
        resizeMap();
    } catch (error) {
        document.getElementById('routeSummary').textContent = error.message;
    }
});

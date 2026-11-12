// Shared Rider route renderer used by the dashboard overview and My Route page.
// It renders only the authenticated rider's route data returned by routes?mine=1.
const BomsRiderRouteMap = (() => {
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

    function markerIcon(label, kind = 'stop') {
        return L.divIcon({
            className: `boms-route-marker boms-route-marker-${kind}`,
            html: `<span>${esc(label)}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            popupAnchor: [0, -18],
        });
    }

    function create(mapElementId) {
        const map = L.map(mapElementId).setView([13.3199218, 123.7398304], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
        }).addTo(map);
        let layer = null;

        function resize() {
            requestAnimationFrame(() => map.invalidateSize({ pan: false }));
        }

        function render(route) {
            if (layer) layer.remove();
            if (!route) return;

            layer = L.layerGroup().addTo(map);
            const start = route.start || { name: 'Branch start', latitude: 13.3199218, longitude: 123.7398304 };
            const startPoint = [Number(start.latitude), Number(start.longitude)];
            const points = [startPoint];
            L.marker(startPoint, { icon: markerIcon('S', 'start'), zIndexOffset: 1100 })
                .addTo(layer)
                .bindPopup(esc(start.name));

            route.stops.forEach((stop, index) => {
                const point = [Number(stop.latitude), Number(stop.longitude)];
                points.push(point);
                L.marker(point, { icon: markerIcon(index + 1), zIndexOffset: 1000 })
                    .addTo(layer)
                    .bindPopup(`${index + 1}. ${esc(stop.customer_name)}<br>${esc(stop.customer_address)}<br>${esc(stop.delivery_status)}`);
            });

            const geometry = route.geometry?.coordinates;
            if (geometry?.length) {
                const line = geometry.map(point => [point[1], point[0]]);
                L.polyline(line, { color: '#e84a1b', weight: 5, opacity: .9 }).addTo(layer);
                map.fitBounds(line, { padding: [34, 34] });
            } else if (points.length) {
                map.fitBounds(points, { padding: [34, 34] });
            }
            resize();
        }

        return { map, render, resize };
    }

    function summary(route) {
        return `${(Number(route.total_distance_m) / 1000).toFixed(1)} km · about ${Math.round(Number(route.total_duration_s) / 60)} minutes`;
    }

    function sequence(route) {
        return route.stops.map((stop, index) =>
            `<li><strong>${index + 1}. ${esc(stop.customer_name)}</strong> — ${esc(stop.customer_address)} (${esc(stop.delivery_status)})</li>`
        ).join('');
    }

    return { create, summary, sequence };
})();

Auth.guard(['admin']);

const currentUser = Auth.getUser();
let riders = [];
let stops = [];
let map;
let routeLayer;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const message = text => { document.getElementById('routeMessage').textContent = text; };

function markerIcon(label, kind = 'stop') {
    return L.divIcon({
        className: `boms-route-marker boms-route-marker-${kind}`,
        html: `<span>${esc(label)}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
    });
}

function resizeMap() {
    if (map) requestAnimationFrame(() => map.invalidateSize({ pan: false }));
}

function initMap() {
    if (map) return;
    map = L.map('routeMap').setView([13.3199218, 123.7398304], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
    window.addEventListener('resize', resizeMap);
    resizeMap();
}

async function loadRiders() {
    const data = await Api.get(`deliveries/index.php?deliverers=1&branch_id=${currentUser.branch_id}`);
    riders = data.deliverers;
    document.getElementById('riderSelect').innerHTML = '<option value="">Select rider</option>' + riders.map(rider => `<option value="${rider.id}">${esc(rider.full_name)}</option>`).join('');
}

async function loadStops() {
    const riderId = +document.getElementById('riderSelect').value;
    if (!riderId) return message('Select a rider first.');

    const data = await Api.post('routes/index.php', { action: 'eligible', rider_id: riderId });
    stops = data.deliveries;
    document.getElementById('stopList').innerHTML = stops.length
        ? stops.map(stop => `<label class="stop ${stop.location_confirmed ? '' : 'unconfirmed'}"><input type="checkbox" value="${stop.id}" ${stop.location_confirmed ? '' : 'disabled'}><span><strong>${esc(stop.customer_name)}</strong><small>${esc(stop.customer_address)}</small><small>${stop.location_confirmed ? 'Location confirmed' : 'Location needs admin confirmation before routing'}</small></span></label>`).join('')
        : 'No eligible deliveries assigned to this rider.';
    document.getElementById('planRoute').disabled = stops.filter(stop => stop.location_confirmed).length < 2;
    message('Select at least two confirmed stops.');
    resizeMap();
}

function drawRoute(data) {
    if (routeLayer) routeLayer.remove();
    routeLayer = L.layerGroup().addTo(map);

    const start = data.start || { name: 'E.V.A. Gas Trading · Start', latitude: 13.3199218, longitude: 123.7398304 };
    const startPoint = [+start.latitude, +start.longitude];
    const bounds = [startPoint];
    L.marker(startPoint, { icon: markerIcon('S', 'start'), zIndexOffset: 1100 }).addTo(routeLayer).bindPopup(esc(start.name || 'Branch start'));

    data.stops.forEach((stop, index) => {
        const point = [+stop.latitude, +stop.longitude];
        bounds.push(point);
        L.marker(point, { icon: markerIcon(index + 1), zIndexOffset: 1000 })
            .addTo(routeLayer)
            .bindPopup(`${index + 1}. ${esc(stop.customer_name)}<br>${esc(stop.customer_address)}`);
    });

    if (data.geometry?.coordinates?.length) {
        const line = data.geometry.coordinates.map(point => [point[1], point[0]]);
        L.polyline(line, { color: '#e84a1b', weight: 5, opacity: .9 }).addTo(routeLayer);
        map.fitBounds(line, { padding: [34, 34] });
    } else if (bounds.length) {
        map.fitBounds(bounds, { padding: [34, 34] });
    }

    document.getElementById('routeSummary').textContent = `${(data.distance_m / 1000).toFixed(1)} km · about ${Math.round(data.duration_s / 60)} minutes`;
    document.getElementById('routeSequence').innerHTML = data.stops.map((stop, index) => `<li><strong>${index + 1}. ${esc(stop.customer_name)}</strong> — ${esc(stop.customer_address)}</li>`).join('');
    resizeMap();
}

async function plan() {
    const riderId = +document.getElementById('riderSelect').value;
    const ids = [...document.querySelectorAll('#stopList input:checked')].map(input => +input.value);
    if (ids.length < 2) return message('Select at least two confirmed stops.');

    const button = document.getElementById('planRoute');
    button.disabled = true;
    try {
        message('Calculating road route…');
        drawRoute(await Api.post('routes/index.php', { action: 'plan', rider_id: riderId, delivery_ids: ids }));
        message('Route saved for this rider.');
    } catch (error) {
        message(error.message || 'Route planning could not be completed.');
    } finally {
        button.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    renderSidebar();
    initMap();
    try { await loadRiders(); } catch (error) { message(error.message); }
});

document.getElementById('loadStops').onclick = loadStops;
document.getElementById('planRoute').onclick = plan;

Auth.guard(['admin']);

const currentUser = Auth.getUser();
let riders = [];
let stops = [];
let map;
let routeLayer;
let previewLayer;
let stopMarkers = new Map();

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
const message = text => { document.getElementById('routeMessage').textContent = text; };

function markerIcon(label, kind = 'stop') {
    return L.divIcon({
        className: `boms-route-marker boms-route-marker-${kind}`,
        html: `<span>${esc(label)}</span>`,
        iconSize: [36, 44],
        iconAnchor: [18, 42],
        popupAnchor: [0, -40],
    });
}

function coordinates(stop) {
    const latitude = Number(stop.latitude);
    const longitude = Number(stop.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
        ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        : 'Coordinates unavailable';
}

function stopPopup(stop, label) {
    return `<strong>${esc(label)}. ${esc(stop.customer_name)}</strong><br>${esc(stop.customer_address)}<br><small>Saved pin: ${esc(coordinates(stop))}</small>`;
}

function focusStop(stopId) {
    const marker = stopMarkers.get(Number(stopId));
    if (!marker) return;
    map.setView(marker.getLatLng(), 18, { animate: true });
    marker.openPopup();
}

function bindLocateButtons(container = document) {
    container.querySelectorAll('[data-focus-stop]').forEach(button => {
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            focusStop(button.dataset.focusStop);
        });
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
        ? stops.map(stop => `<label class="stop ${stop.location_confirmed ? '' : 'unconfirmed'}"><input type="checkbox" value="${stop.id}" ${stop.location_confirmed ? '' : 'disabled'}><span><strong>${esc(stop.customer_name)}</strong><small>${esc(stop.customer_address)}</small><small>Saved pin: ${esc(coordinates(stop))}</small><small>${stop.location_confirmed ? 'Location confirmed' : 'Location needs admin confirmation before routing'}</small><button class="stop-locate" type="button" data-focus-stop="${stop.id}">Locate on map</button></span></label>`).join('')
        : 'No eligible deliveries assigned to this rider.';
    document.getElementById('planRoute').disabled = stops.filter(stop => stop.location_confirmed).length < 2;
    drawStopPreview();
    bindLocateButtons(document.getElementById('stopList'));
    message('Select at least two confirmed stops.');
    resizeMap();
}

function drawStopPreview() {
    if (routeLayer) { routeLayer.remove(); routeLayer = null; }
    if (previewLayer) previewLayer.remove();
    previewLayer = L.layerGroup().addTo(map);
    stopMarkers.clear();

    const confirmedStops = stops.filter(stop => stop.location_confirmed && Number.isFinite(Number(stop.latitude)) && Number.isFinite(Number(stop.longitude)));
    if (!confirmedStops.length) return;

    const bounds = [];
    confirmedStops.forEach((stop, index) => {
        const point = [Number(stop.latitude), Number(stop.longitude)];
        bounds.push(point);
        const marker = L.marker(point, { icon: markerIcon(index + 1), zIndexOffset: 1000 })
            .addTo(previewLayer)
            .bindPopup(stopPopup(stop, index + 1));
        stopMarkers.set(Number(stop.id), marker);
    });
    if (bounds.length === 1) map.setView(bounds[0], 16);
    else map.fitBounds(bounds, { padding: [34, 34] });
}

function drawRoute(data) {
    if (routeLayer) routeLayer.remove();
    if (previewLayer) { previewLayer.remove(); previewLayer = null; }
    routeLayer = L.layerGroup().addTo(map);
    stopMarkers.clear();

    const start = data.start || { name: 'E.V.A. Gas Trading · Start', latitude: 13.3199218, longitude: 123.7398304 };
    const startPoint = [+start.latitude, +start.longitude];
    const bounds = [startPoint];
    L.marker(startPoint, { icon: markerIcon('S', 'start'), zIndexOffset: 1100 }).addTo(routeLayer).bindPopup(esc(start.name || 'Branch start'));

    data.stops.forEach((stop, index) => {
        const point = [+stop.latitude, +stop.longitude];
        bounds.push(point);
        const marker = L.marker(point, { icon: markerIcon(index + 1), zIndexOffset: 1000 })
            .addTo(routeLayer)
            .bindPopup(stopPopup(stop, index + 1));
        stopMarkers.set(Number(stop.id), marker);
    });

    if (data.geometry?.coordinates?.length) {
        const line = data.geometry.coordinates.map(point => [point[1], point[0]]);
        L.polyline(line, { color: getComputedStyle(document.documentElement).getPropertyValue('--flame').trim() || '#005B5B', weight: 5, opacity: .9 }).addTo(routeLayer);
        map.fitBounds(line, { padding: [34, 34] });
    } else if (bounds.length) {
        map.fitBounds(bounds, { padding: [34, 34] });
    }

    document.getElementById('routeSummary').textContent = `${(data.distance_m / 1000).toFixed(1)} km · about ${Math.round(data.duration_s / 60)} minutes`;
    document.getElementById('routeSequence').innerHTML = data.stops.map((stop, index) => `<li><button class="route-stop-focus" type="button" data-focus-stop="${stop.id}"><strong>${index + 1}. ${esc(stop.customer_name)}</strong> — ${esc(stop.customer_address)}</button><small>Saved pin: ${esc(coordinates(stop))}</small></li>`).join('');
    bindLocateButtons(document.getElementById('routeSequence'));
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
        const data = await Api.post('routes/index.php', { action: 'plan', rider_id: riderId, delivery_ids: ids });
        drawRoute(data);
        const warnings = data.location_warnings || [];
        message(warnings.length
            ? `Route saved. Recheck ${warnings.length} pin${warnings.length === 1 ? '' : 's'} more than 100 m from a drivable road.`
            : 'Route saved for this rider.');
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

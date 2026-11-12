(() => {
    const base = (() => {
        const publicIndex = window.location.pathname.indexOf('/public/');
        return `${publicIndex > 0 ? window.location.pathname.slice(0, publicIndex) : ''}/api/customer/index.php`;
    })();
    const malilipot = [13.3199218, 123.7398304];
    let map, marker, selectedLocation = null, submitting = false;
    const $ = id => document.getElementById(id);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

    async function request(url = '', options = {}) {
        const response = await fetch(`${base}${url}`, { headers: { 'Content-Type': 'application/json' }, ...options });
        const data = await response.json().catch(() => ({ success: false, message: 'Unexpected server response.' }));
        if (!data.success) throw new Error(data.message || 'Request failed.');
        return data.data;
    }
    function token() {
        if (crypto?.randomUUID) return crypto.randomUUID();
        return `${Date.now()}-${Math.random().toString(16).slice(2)}-0000-4000-8000-000000000000`.slice(0, 36);
    }
    const requestToken = token();
    function message(id, text = '', kind = '') { const el = $(id); el.textContent = text; el.className = `form-message ${kind}`; }
    function customerPinIcon() {
        return L.divIcon({
            className: 'boms-customer-pin',
            html: `<span>${BomsIcons.icon('flame')}</span>`,
            iconSize: [34, 34],
            iconAnchor: [17, 17],
            popupAnchor: [0, -18],
        });
    }
    function placeMarker(latitude, longitude, label = 'Selected delivery location') {
        selectedLocation = { latitude: Number(latitude), longitude: Number(longitude), label };
        if (!marker) {
            marker = L.marker([latitude, longitude], { draggable: true, icon: customerPinIcon(), zIndexOffset: 1000 }).addTo(map);
            marker.on('dragend', event => {
                const point = event.target.getLatLng();
                placeMarker(point.lat, point.lng, 'Adjusted map location');
            });
        } else marker.setLatLng([latitude, longitude]);
        map.setView([latitude, longitude], 16);
        $('locationInfo').textContent = `Selected: ${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}. Please review the pin before sending.`;
    }
    function initMap() {
        map = L.map('customerMap').setView(malilipot, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(map);
        map.on('click', event => placeMarker(event.latlng.lat, event.latlng.lng, 'Map-selected location'));
    }
    async function loadProducts() {
        try {
            const data = await request('?action=products');
            $('productId').innerHTML = '<option value="">Select an available LPG product</option>' + data.products.map(product => `<option value="${product.id}">${esc(product.product_name)}${product.category ? ` · ${esc(product.category)}` : ''} · ₱${Number(product.price).toLocaleString('en-PH',{minimumFractionDigits:2})}</option>`).join('');
            if (!data.products.length) $('productId').innerHTML = '<option value="">No LPG products are available right now</option>';
        } catch (error) { $('productId').innerHTML = '<option value="">Products are temporarily unavailable</option>'; message('formMessage', error.message, 'error'); }
    }
    async function searchLocation() {
        const query = $('locationSearch').value.trim();
        if (query.length < 3) return message('formMessage', 'Enter at least three characters to search for a location.', 'error');
        $('locationResults').textContent = 'Searching Malilipot, Albay…';
        try {
            const data = await request(`?action=location_search&q=${encodeURIComponent(query)}`);
            $('locationResults').innerHTML = data.locations.length
                ? data.locations.map((place, index) => `<button type="button" class="location-result" data-location="${index}">${esc(place.label)}</button>`).join('')
                : 'No matching Malilipot, Albay result found. Tap the map to place a pin.';
            $('locationResults').querySelectorAll('[data-location]').forEach(button => button.addEventListener('click', () => {
                const place = data.locations[Number(button.dataset.location)]; placeMarker(place.latitude, place.longitude, place.label);
            }));
        } catch (error) { $('locationResults').textContent = ''; message('formMessage', error.message, 'error'); }
    }
    function useCurrentLocation() {
        if (!navigator.geolocation) return message('formMessage', 'Location is not supported by this browser. Search or tap the map instead.', 'error');
        message('formMessage', 'Requesting your device location…');
        navigator.geolocation.getCurrentPosition(
            position => { placeMarker(position.coords.latitude, position.coords.longitude, 'Device location'); message('formMessage'); },
            () => message('formMessage', 'Location permission was not granted. Search or tap the map to set your delivery pin.', 'error'),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
    }
    async function submit(event) {
        event.preventDefault();
        if (submitting) return;
        if (!selectedLocation) return message('formMessage', 'Choose and review your delivery location on the map first.', 'error');
        const form = $('requestForm');
        if (!form.reportValidity()) return;
        submitting = true; $('submitRequest').disabled = true; message('formMessage', 'Sending your delivery request…');
        try {
            const result = await request('', { method: 'POST', body: JSON.stringify({
                customer_name: $('customerName').value.trim(), customer_phone: $('customerPhone').value.trim(), customer_address: $('customerAddress').value.trim(),
                product_id: Number($('productId').value), quantity: Number($('quantity').value), notes: $('notes').value.trim(),
                latitude: selectedLocation.latitude, longitude: selectedLocation.longitude, request_token: requestToken,
            }) });
            const duplicate = result.duplicate ? 'This request was already received.' : 'Your delivery request was received.';
            $('confirmation').hidden = false;
            $('confirmation').innerHTML = `<h2>${duplicate}</h2><p>Reference: <strong>${esc(result.reference)}</strong></p><p>Your request is pending Admin review. It will not create a sale, deduct stock, assign a rider, or confirm the location automatically.</p>`;
            $('confirmation').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            form.reset(); $('locationResults').innerHTML = ''; message('formMessage', '', 'success');
        } catch (error) { message('formMessage', error.message, 'error'); }
        finally { submitting = false; $('submitRequest').disabled = false; }
    }
    async function checkStatus(event) {
        event.preventDefault(); message('statusMessage', 'Checking request…');
        try {
            const reference = $('statusReference').value.trim().toUpperCase();
            const phone = $('statusPhone').value.trim();
            const data = await request(`?action=status&reference=${encodeURIComponent(reference)}&phone=${encodeURIComponent(phone)}`);
            message('statusMessage', `${data.reference}: ${data.request_status}. ${data.product_name} × ${data.quantity}. Delivery status: ${data.delivery_status}.`, 'success');
        } catch (error) { message('statusMessage', error.message, 'error'); }
    }
    document.addEventListener('DOMContentLoaded', () => {
        initMap(); loadProducts();
        $('searchLocation').addEventListener('click', searchLocation);
        $('locationSearch').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); searchLocation(); } });
        $('useLocation').addEventListener('click', useCurrentLocation);
        $('requestForm').addEventListener('submit', submit);
        $('statusForm').addEventListener('submit', checkStatus);
    });
})();

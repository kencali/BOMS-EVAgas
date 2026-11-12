<?php
// Public customer delivery requests. This endpoint intentionally has no JWT
// requirement, but it exposes only orderable products and tightly validated
// request/status data.
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/location.php';
require_once __DIR__ . '/../helpers/customer_requests.php';

setJsonHeaders();
$db = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$branchId = (int)(bomsEnvValue('BOMS_CUSTOMER_BRANCH_ID') ?? '1');

function customerError(string $message, int $code = 400): never { sendError($message, $code); }
function customerReference(PDO $db): string {
    for ($try = 0; $try < 8; $try++) {
        $reference = 'REQ-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $check = $db->prepare('SELECT id FROM deliveries WHERE customer_reference = ?');
        $check->execute([$reference]);
        if (!$check->fetch()) return $reference;
    }
    throw new RuntimeException('Could not generate a request reference. Please try again.');
}
function validCustomerPhone(string $phone): bool {
    $digits = preg_replace('/\D+/', '', $phone);
    return (bool)preg_match('/^(?:0?9\d{9}|639\d{9})$/', $digits);
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'products') {
    $products = $db->prepare("SELECT id, product_name, category, price FROM products WHERE branch_id = ? AND status = 'Active' AND stock > 0 ORDER BY product_name ASC");
    $products->execute([$branchId]);
    sendSuccess(['products' => $products->fetchAll()]);
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'location_search') {
    $query = trim((string)($_GET['q'] ?? ''));
    if (mb_strlen($query) < 3 || mb_strlen($query) > 160) customerError('Enter at least three characters to search for a location.');
    try {
        $places = bomsGeocodeRequest('/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ph&q=' . rawurlencode($query . ', Malilipot, Albay, Philippines'));
        $places = array_values(array_filter($places, 'bomsIsMalilipot'));
        sendSuccess(['locations' => array_map(fn($place) => [
            'label' => $place['display_name'],
            'latitude' => (float)$place['lat'],
            'longitude' => (float)$place['lon'],
        ], $places)]);
    } catch (RuntimeException $error) {
        customerError($error->getMessage(), 503);
    }
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'status') {
    if (!customerRequestSchemaReady($db)) customerError('Customer requests are not available until the CUST-001 migration is applied.', 503);
    $reference = strtoupper(trim((string)($_GET['reference'] ?? '')));
    $phone = trim((string)($_GET['phone'] ?? ''));
    if (!preg_match('/^REQ-\d{8}-[A-F0-9]{6}$/', $reference) || !validCustomerPhone($phone)) customerError('Enter your request reference and the contact number used for the request.');
    $stmt = $db->prepare("SELECT d.customer_reference, d.request_status, d.delivery_status, d.quantity, d.created_at, p.product_name FROM deliveries d JOIN products p ON p.id=d.product_id WHERE d.customer_reference = ? AND REPLACE(REPLACE(REPLACE(REPLACE(d.customer_phone, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ? LIMIT 1");
    $digits = preg_replace('/\D+/', '', $phone);
    $stmt->execute([$reference, '%' . substr($digits, -10)]);
    $request = $stmt->fetch();
    if (!$request) customerError('Request not found. Check the reference and contact number.', 404);
    sendSuccess(['reference' => $request['customer_reference'], 'request_status' => $request['request_status'], 'delivery_status' => $request['delivery_status'], 'product_name' => $request['product_name'], 'quantity' => (int)$request['quantity'], 'submitted_at' => $request['created_at']]);
}

if ($method !== 'POST') customerError('Method not allowed.', 405);
if (!customerRequestSchemaReady($db)) customerError('Customer requests are not available until the CUST-001 migration is applied.', 503);

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) customerError('Invalid request data.');
$name = trim((string)($body['customer_name'] ?? ''));
$phone = trim((string)($body['customer_phone'] ?? ''));
$address = trim((string)($body['customer_address'] ?? ''));
$notes = trim((string)($body['notes'] ?? ''));
$productId = (int)($body['product_id'] ?? 0);
$quantity = (int)($body['quantity'] ?? 0);
$latitude = filter_var($body['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
$longitude = filter_var($body['longitude'] ?? null, FILTER_VALIDATE_FLOAT);
$token = trim((string)($body['request_token'] ?? ''));

if (mb_strlen($name) < 2 || mb_strlen($name) > 100) customerError('Enter a valid customer name.');
if (!validCustomerPhone($phone)) customerError('Enter a valid Philippine mobile number.');
if (mb_strlen($address) < 5 || mb_strlen($address) > 1000) customerError('Enter a complete delivery address.');
if ($productId <= 0 || $quantity < 1 || $quantity > 50) customerError('Select a product and a quantity from 1 to 50.');
if ($latitude === false || $longitude === false) customerError('Choose a delivery location on the map.');
if (!preg_match('/^[a-f0-9-]{36}$/i', $token)) customerError('Invalid request token. Refresh the page and try again.');

try {
    customerRequestRateLimit($db);
    bomsValidateMalilipotCoordinates((float)$latitude, (float)$longitude);
    $db->beginTransaction();
    $duplicate = $db->prepare('SELECT customer_reference FROM deliveries WHERE customer_request_token = ? FOR UPDATE');
    $duplicate->execute([$token]);
    if ($existing = $duplicate->fetch()) {
        $db->commit();
        sendSuccess(['reference' => $existing['customer_reference'], 'duplicate' => true]);
    }

    $product = $db->prepare("SELECT id FROM products WHERE id = ? AND branch_id = ? AND status = 'Active' AND stock >= ? FOR UPDATE");
    $product->execute([$productId, $branchId, $quantity]);
    if (!$product->fetch()) throw new RuntimeException('The selected product is unavailable in the requested quantity.');

    $reference = customerReference($db);
    $insert = $db->prepare("INSERT INTO deliveries (branch_id, customer_name, customer_phone, customer_reference, request_source, request_status, customer_request_token, customer_address, latitude, longitude, submitted_latitude, submitted_longitude, location_confirmed, product_id, quantity, delivery_status, assigned_to, notes, created_by, created_at) VALUES (?, ?, ?, ?, 'Customer', 'Pending Review', ?, ?, ?, ?, ?, ?, 0, ?, ?, 'Pending', NULL, ?, NULL, NOW())");
    $insert->execute([$branchId, $name, $phone, $reference, $token, $address, $latitude, $longitude, $latitude, $longitude, $productId, $quantity, $notes ?: null]);
    $deliveryId = (int)$db->lastInsertId();
    $db->commit();
    sendSuccess(['reference' => $reference, 'delivery_id' => $deliveryId, 'request_status' => 'Pending Review'], 201);
} catch (RuntimeException $error) {
    if ($db->inTransaction()) $db->rollBack();
    customerError($error->getMessage(), str_contains($error->getMessage(), 'unavailable') ? 503 : 400);
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    error_log('BOMS customer delivery request failed.');
    customerError('Your request could not be saved. Please try again later.', 500);
}

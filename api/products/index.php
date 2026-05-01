<?php
// ============================================================
// FILE: api/products/index.php
// PURPOSE: Full CRUD for products — one file, four operations.
//          Replaces: products.php, add_product.php,
//                    edit_product.php, delete_product.php
//
// ROUTES (read by HTTP method + optional ?id=):
//   GET    /api/products/index.php              → list all products
//   GET    /api/products/index.php?id=5         → single product
//   POST   /api/products/index.php              → create product
//   PUT    /api/products/index.php?id=5         → update product
//   DELETE /api/products/index.php?id=5         → delete (soft)
//
// ACCESS:
//   GET           → admin + employee (employee needs it for POS)
//   POST/PUT/DELETE → admin only
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

$method = $_SERVER['REQUEST_METHOD'];

// ── Who is calling? ───────────────────────────────────────
// GET is allowed for both admin and employee (POS needs product list)
// All writes are admin-only
if ($method === 'GET') {
    $user = requireAuth(['admin', 'employee']);
} else {
    $user = requireAuth('admin');
}

$db = getDB();

// ── GET: List products or single product ──────────────────
if ($method === 'GET') {

    // Single product by ID
    if (isset($_GET['id'])) {
        $stmt = $db->prepare("
            SELECT id, product_name, category, price, stock, status, branch_id
            FROM products
            WHERE id = ? AND branch_id = ?
        ");
        $stmt->execute([(int)$_GET['id'], $user['branch_id']]);
        $product = $stmt->fetch();

        if (!$product) sendError('Product not found.', 404);
        sendSuccess($product);
    }

    // List — optionally filter by branch (admin can request other branch read-only)
    $branchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : $user['branch_id'];
    requireBranchAccess($user, $branchId, 'read');

    // Optional filters
    $statusFilter   = $_GET['status']   ?? 'Active'; // default: only Active
    $searchKeyword  = $_GET['search']   ?? '';

    $params = [$branchId];
    $where  = ['branch_id = ?'];

    if ($statusFilter !== 'all') {
        $where[]  = 'status = ?';
        $params[] = $statusFilter;
    }

    if ($searchKeyword !== '') {
        $where[]  = 'product_name LIKE ?';
        $params[] = "%$searchKeyword%";
    }

    $whereSQL = implode(' AND ', $where);

    $stmt = $db->prepare("
        SELECT id, product_name, category, price, stock, status, branch_id
        FROM products
        WHERE $whereSQL
        ORDER BY product_name ASC
    ");
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    sendSuccess([
        'products' => $products,
        'count'    => count($products),
        'branch_id'=> $branchId,
    ]);
}

// ── POST: Create new product ──────────────────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $name     = trim($body['product_name'] ?? '');
    $category = trim($body['category']     ?? 'General');
    $price    = (float)($body['price']     ?? 0);
    $stock    = (int)  ($body['stock']     ?? 0);

    // Validate
    if (empty($name))    sendError('Product name is required.');
    if ($price <= 0)     sendError('Price must be greater than zero.');
    if ($stock  < 0)     sendError('Stock cannot be negative.');

    // Check for duplicate name in same branch
    $check = $db->prepare("SELECT id FROM products WHERE product_name = ? AND branch_id = ?");
    $check->execute([$name, $user['branch_id']]);
    if ($check->fetch()) sendError("A product named \"$name\" already exists in this branch.");

    $stmt = $db->prepare("
        INSERT INTO products (product_name, category, price, stock, status, branch_id)
        VALUES (?, ?, ?, ?, 'Active', ?)
    ");
    $stmt->execute([$name, $category, $price, $stock, $user['branch_id']]);

    sendSuccess([
        'id'           => (int)$db->lastInsertId(),
        'product_name' => $name,
        'category'     => $category,
        'price'        => $price,
        'stock'        => $stock,
        'status'       => 'Active',
        'branch_id'    => $user['branch_id'],
    ], 201); // 201 = Created
}

// ── PUT: Update existing product ──────────────────────────
if ($method === 'PUT') {
    $id   = (int)($_GET['id'] ?? 0);
    $body = json_decode(file_get_contents('php://input'), true);

    if (!$id) sendError('Product ID is required.');

    // Confirm it belongs to this admin's branch
    $check = $db->prepare("SELECT id FROM products WHERE id = ? AND branch_id = ?");
    $check->execute([$id, $user['branch_id']]);
    if (!$check->fetch()) sendError('Product not found or not in your branch.', 404);

    $name     = trim($body['product_name'] ?? '');
    $category = trim($body['category']     ?? 'General');
    $price    = (float)($body['price']     ?? 0);
    $stock    = (int)  ($body['stock']     ?? 0);
    $status   = in_array($body['status'] ?? '', ['Active','Inactive'])
                    ? $body['status'] : 'Active';

    if (empty($name)) sendError('Product name is required.');
    if ($price <= 0)  sendError('Price must be greater than zero.');
    if ($stock  < 0)  sendError('Stock cannot be negative.');

    $stmt = $db->prepare("
        UPDATE products
        SET product_name = ?, category = ?, price = ?, stock = ?, status = ?
        WHERE id = ? AND branch_id = ?
    ");
    $stmt->execute([$name, $category, $price, $stock, $status, $id, $user['branch_id']]);

    sendSuccess(['updated' => true, 'id' => $id]);
}

// ── DELETE: Soft-delete (sets status = Inactive) ─────────
// Soft-delete means the row stays in the DB so old orders/records
// that reference this product don't break.
if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) sendError('Product ID is required.');

    $check = $db->prepare("SELECT id FROM products WHERE id = ? AND branch_id = ?");
    $check->execute([$id, $user['branch_id']]);
    if (!$check->fetch()) sendError('Product not found or not in your branch.', 404);

    $stmt = $db->prepare("UPDATE products SET status = 'Inactive' WHERE id = ?");
    $stmt->execute([$id]);

    sendSuccess(['deleted' => true, 'id' => $id]);
}

sendError('Method not allowed.', 405);
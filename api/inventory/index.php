<?php
// ============================================================
// FILE: api/inventory/index.php
// PLACE IN: /api/inventory/index.php
//
// WHY SEPARATE FROM PRODUCTS API?
//   products/index.php handles product CRUD (name, price, category).
//   inventory/index.php handles stock adjustments only.
//   Separating them keeps each file focused on one job.
//
// ROUTES:
//   GET  ?branch_id=1           → list all products with stock levels
//   GET  ?branch_id=1&low=1     → only low-stock products (≤ 5 units)
//   PUT  ?id=5                  → adjust stock for one product
//
// ACCESS:
//   GET → admin + employee (employee reads stock for POS awareness)
//   PUT → admin only (only admin can adjust stock manually)
//
// DB TABLE USED: products
//   Columns read:  id, branch_id, product_name, category, price, stock, status
//   Column written: stock (via PUT)
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── Access control per method ──────────────────────────────
if ($method === 'GET') {
    $user = requireAuth(['admin', 'employee']);
} elseif ($method === 'PUT') {
    $user = requireAuth('admin');
} else {
    sendError('Method not allowed.', 405);
}

// ── GET: Stock list ────────────────────────────────────────
if ($method === 'GET') {
    $branchId = isset($_GET['branch_id'])
        ? (int)$_GET['branch_id']
        : $user['branch_id'];

    requireBranchAccess($user, $branchId, 'read');

    // Optional: only return low-stock items
    $lowOnly      = isset($_GET['low']) && $_GET['low'] === '1';
    $stockFilter  = $lowOnly ? 'AND p.stock <= 5' : '';

    $stmt = $db->prepare("
        SELECT
            p.id,
            p.branch_id,
            p.product_name,
            p.category,
            p.price,
            p.stock,
            p.status
        FROM products p
        WHERE p.branch_id = ?
          AND p.status    = 'Active'
          $stockFilter
        ORDER BY p.stock ASC, p.product_name ASC
    ");
    $stmt->execute([$branchId]);
    $products = $stmt->fetchAll();

    // Summary counts for the header cards
    $summaryStmt = $db->prepare("
        SELECT
            COUNT(*)                            AS total_products,
            SUM(CASE WHEN stock  = 0  THEN 1 ELSE 0 END) AS out_of_stock,
            SUM(CASE WHEN stock <= 5
                      AND stock  > 0  THEN 1 ELSE 0 END) AS low_stock,
            SUM(CASE WHEN stock  > 5  THEN 1 ELSE 0 END) AS ok_stock,
            COALESCE(SUM(stock), 0)             AS total_units
        FROM products
        WHERE branch_id = ? AND status = 'Active'
    ");
    $summaryStmt->execute([$branchId]);
    $summary = $summaryStmt->fetch();

    sendSuccess([
        'products'  => $products,
        'count'     => count($products),
        'summary'   => $summary,
        'branch_id' => $branchId,
    ]);
}

// ── PUT: Adjust stock for one product ─────────────────────
if ($method === 'PUT') {
    $productId = (int)($_GET['id'] ?? 0);
    if (!$productId) sendError('Product ID is required.');

    // Confirm product belongs to admin's branch
    $check = $db->prepare("
        SELECT id, product_name, stock
        FROM products
        WHERE id = ? AND branch_id = ? AND status = 'Active'
    ");
    $check->execute([$productId, $user['branch_id']]);
    $product = $check->fetch();
    if (!$product) sendError('Product not found or not in your branch.', 404);

    $body          = json_decode(file_get_contents('php://input'), true);
    $adjustType    = $body['adjust_type'] ?? '';  // 'set' | 'add' | 'subtract'
    $adjustAmount  = (int)($body['amount'] ?? 0);
    $reason        = trim($body['reason'] ?? '');

    // Validate adjust_type
    $validTypes = ['set', 'add', 'subtract'];
    if (!in_array($adjustType, $validTypes)) {
        sendError('adjust_type must be: set, add, or subtract.');
    }
    if ($adjustAmount < 0) sendError('Amount cannot be negative.');

    // Calculate new stock value
    if ($adjustType === 'set') {
        $newStock = $adjustAmount;
    } elseif ($adjustType === 'add') {
        $newStock = $product['stock'] + $adjustAmount;
    } elseif ($adjustType === 'subtract') {
        $newStock = $product['stock'] - $adjustAmount;
        if ($newStock < 0) {
            sendError("Cannot subtract {$adjustAmount} from current stock of {$product['stock']}.");
        }
    }

    $stmt = $db->prepare("
        UPDATE products SET stock = ? WHERE id = ? AND branch_id = ?
    ");
    $stmt->execute([$newStock, $productId, $user['branch_id']]);

    sendSuccess([
        'updated'       => true,
        'id'            => $productId,
        'product_name'  => $product['product_name'],
        'old_stock'     => (int)$product['stock'],
        'new_stock'     => $newStock,
        'adjust_type'   => $adjustType,
        'amount'        => $adjustAmount,
    ]);
}
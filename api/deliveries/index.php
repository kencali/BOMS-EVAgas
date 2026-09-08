<?php
// ============================================================
// FILE: api/deliveries/index.php
//
// ROUTES:
//   GET    ?branch_id=1              → list deliveries (filtered)
//   GET    ?id=5                     → single delivery detail
//   GET    ?deliverers=1&branch_id=1 → list deliverer users for dropdown
//   POST                             → create delivery  [admin, employee]
//   PUT    ?id=5                     → update full delivery  [admin]
//   PUT    ?id=5&action=status       → update status only    [deliverer]
//   DELETE ?id=5                     → cancel delivery  [admin]
//
// ACCESS:
//   GET, POST → admin + employee
//   PUT (full update), DELETE → admin only
//   PUT (status only) → admin + deliverer
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

/**
 * Completes one in-progress delivery as one linked sales transaction.
 *
 * @return array<string, int|string>
 */
function completeDelivery(PDO $db, int $deliveryId, array $user): array {
    $db->beginTransaction();

    try {
        $deliveryStmt = $db->prepare("SELECT * FROM deliveries WHERE id = ? FOR UPDATE");
        $deliveryStmt->execute([$deliveryId]);
        $delivery = $deliveryStmt->fetch();

        if (!$delivery || (int)$delivery['branch_id'] !== (int)$user['branch_id']) {
            throw new RuntimeException('Delivery not found or not in your branch.');
        }

        if ($user['role'] === 'deliverer' && (int)$delivery['assigned_to'] !== (int)$user['user_id']) {
            throw new RuntimeException('Delivery not found or not assigned to you.');
        }

        if ((int)$delivery['sale_confirmed'] === 1 || $delivery['delivery_status'] === 'Delivered') {
            throw new RuntimeException('This delivery has already been completed. No additional sale was created.');
        }

        if (in_array($delivery['delivery_status'], ['Cancelled', 'Voided'], true)) {
            throw new RuntimeException('Cancelled or voided deliveries cannot be completed.');
        }

        if ($delivery['delivery_status'] !== 'On the way') {
            throw new RuntimeException('Delivery must be marked "On the way" before it can be completed.');
        }

        $saleCheck = $db->prepare("SELECT id FROM sales WHERE delivery_id = ? FOR UPDATE");
        $saleCheck->execute([$deliveryId]);
        if ($saleCheck->fetch()) {
            throw new RuntimeException('A sale is already linked to this delivery. No additional sale was created.');
        }

        $productStmt = $db->prepare("
            SELECT id, product_name, price, stock
            FROM products
            WHERE id = ? AND branch_id = ? AND status = 'Active'
            FOR UPDATE
        ");
        $productStmt->execute([$delivery['product_id'], $delivery['branch_id']]);
        $product = $productStmt->fetch();

        if (!$product) {
            throw new RuntimeException('Delivery product not found or inactive.');
        }
        if ((int)$product['stock'] < (int)$delivery['quantity']) {
            throw new RuntimeException("Not enough stock to complete delivery. Available: {$product['stock']}.");
        }

        $referenceNo = null;
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $candidate = 'BOMS-' . date('Ymd') . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
            $referenceCheck = $db->prepare("SELECT id FROM sales WHERE reference_no = ?");
            $referenceCheck->execute([$candidate]);
            if (!$referenceCheck->fetch()) {
                $referenceNo = $candidate;
                break;
            }
        }
        if (!$referenceNo) {
            throw new RuntimeException('Could not generate a sale reference number. Please try again.');
        }

        $totalAmount = (float)$product['price'] * (int)$delivery['quantity'];
        $saleStmt = $db->prepare("
            INSERT INTO sales
                (reference_no, branch_id, total_amount, amount_tendered,
                 change_amount, sale_type, delivery_id, created_by, sale_date)
            VALUES (?, ?, ?, ?, 0, 'delivery', ?, ?, NOW())
        ");
        $saleStmt->execute([
            $referenceNo,
            $delivery['branch_id'],
            $totalAmount,
            $totalAmount,
            $deliveryId,
            $user['user_id'],
        ]);
        $saleId = (int)$db->lastInsertId();

        $itemStmt = $db->prepare("
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?)
        ");
        $itemStmt->execute([
            $saleId,
            $delivery['product_id'],
            $delivery['quantity'],
            $product['price'],
            $totalAmount,
        ]);

        $stockStmt = $db->prepare("
            UPDATE products
            SET stock = stock - ?
            WHERE id = ? AND branch_id = ? AND stock >= ?
        ");
        $stockStmt->execute([
            $delivery['quantity'],
            $delivery['product_id'],
            $delivery['branch_id'],
            $delivery['quantity'],
        ]);
        if ($stockStmt->rowCount() !== 1) {
            throw new RuntimeException('Not enough stock to complete delivery.');
        }

        $completeStmt = $db->prepare("
            UPDATE deliveries
            SET delivery_status = 'Delivered', delivered_at = NOW(), sale_confirmed = 1
            WHERE id = ? AND sale_confirmed = 0 AND delivery_status = 'On the way'
        ");
        $completeStmt->execute([$deliveryId]);
        if ($completeStmt->rowCount() !== 1) {
            throw new RuntimeException('Delivery completion could not be confirmed.');
        }

        $db->commit();
        return ['sale_id' => $saleId, 'reference_no' => $referenceNo];
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
}

// ── Route: GET deliverer user list for dropdown ───────────
// Called before auth check so we can reuse for both admin + employee
if ($method === 'GET' && isset($_GET['deliverers'])) {
    $user     = requireAuth(['admin', 'employee']);
    $branchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : $user['branch_id'];

    $stmt = $db->prepare("
        SELECT id, full_name
        FROM users
        WHERE role = 'deliverer' AND branch_id = ?
        ORDER BY full_name ASC
    ");
    $stmt->execute([$branchId]);
    $deliverers = $stmt->fetchAll();
    sendSuccess(['deliverers' => $deliverers]);
}

// ── Determine access by method + action ───────────────────
$action = $_GET['action'] ?? '';

if ($method === 'GET' || $method === 'POST') {
    $user = requireAuth(['admin', 'employee', 'deliverer']);
} elseif ($method === 'PUT' && $action === 'status') {
    $user = requireAuth(['admin', 'deliverer']);
} elseif ($method === 'PUT' || $method === 'DELETE') {
    $user = requireAuth('admin');
} else {
    sendError('Method not allowed.', 405);
}

// ── GET: Single delivery ──────────────────────────────────
if ($method === 'GET' && isset($_GET['id'])) {
    $deliveryId = (int)$_GET['id'];

    $stmt = $db->prepare("
        SELECT
            d.id,
            d.branch_id,
            d.customer_name,
            d.customer_phone,
            d.customer_address,
            d.product_id,
            d.quantity,
            d.delivery_status,
            d.assigned_to,
            d.notes,
            d.created_at,
            d.delivered_at,
            p.product_name,
            u.full_name  AS assigned_name,
            c.full_name  AS created_by_name
        FROM deliveries d
        LEFT JOIN products p ON p.id = d.product_id
        LEFT JOIN users    u ON u.id = d.assigned_to
        LEFT JOIN users    c ON c.id = d.created_by
        WHERE d.id = ?
    ");
    $stmt->execute([$deliveryId]);
    $delivery = $stmt->fetch();

    if (!$delivery) sendError('Delivery not found.', 404);

    if ($user['role'] === 'employee' && (int)$delivery['branch_id'] !== (int)$user['branch_id']) {
        sendError('You can only view deliveries from your own branch.', 403);
    }

    // Deliverer can only see their own deliveries
    if ($user['role'] === 'deliverer' && (int)$delivery['assigned_to'] !== $user['user_id']) {
        sendError('Access denied.', 403);
    }

    sendSuccess($delivery);
}

// ── GET: List deliveries ──────────────────────────────────
if ($method === 'GET') {
    $branchId = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : $user['branch_id'];
    if ($user['role'] === 'employee' && $branchId !== (int)$user['branch_id']) {
        sendError('You can only view deliveries from your own branch.', 403);
    }
    requireBranchAccess($user, $branchId, 'read');

    // Deliverer only sees their own assigned deliveries
    $assignedFilter = '';
    $params         = [$branchId];

    if ($user['role'] === 'deliverer') {
        $assignedFilter = 'AND d.assigned_to = ?';
        $params[]       = $user['user_id'];
    }

    // Optional status filter
    $statusFilter = '';
    if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
        $validStatuses = ['Pending', 'On the way', 'Delivered', 'Cancelled'];
        if (in_array($_GET['status'], $validStatuses)) {
            $statusFilter = 'AND d.delivery_status = ?';
            $params[]     = $_GET['status'];
        }
    }

    $stmt = $db->prepare("
        SELECT
            d.id,
            d.branch_id,
            d.customer_name,
            d.customer_phone,
            d.customer_address,
            d.product_id,
            d.quantity,
            d.delivery_status,
            d.assigned_to,
            d.notes,
            d.created_at,
            d.delivered_at,
            p.product_name,
            u.full_name AS assigned_name
        FROM deliveries d
        LEFT JOIN products p ON p.id = d.product_id
        LEFT JOIN users    u ON u.id = d.assigned_to
        WHERE d.branch_id = ?
          $assignedFilter
          $statusFilter
        ORDER BY
            FIELD(d.delivery_status, 'On the way', 'Pending', 'Delivered', 'Cancelled'),
            d.created_at DESC
        LIMIT 300
    ");
    $stmt->execute($params);
    $deliveries = $stmt->fetchAll();

    // Count per status for the summary badges
    $countAssignedFilter = '';
    $countParams         = [$branchId];
    if ($user['role'] === 'deliverer') {
        $countAssignedFilter = 'AND assigned_to = ?';
        $countParams[]       = $user['user_id'];
    }

    $countStmt = $db->prepare("
        SELECT delivery_status, COUNT(*) AS cnt
        FROM deliveries
        WHERE branch_id = ?
          $countAssignedFilter
        GROUP BY delivery_status
    ");
    $countStmt->execute($countParams);
    $rawCounts = $countStmt->fetchAll();

    $counts = ['Pending' => 0, 'On the way' => 0, 'Delivered' => 0, 'Cancelled' => 0];
    foreach ($rawCounts as $row) {
        if (array_key_exists($row['delivery_status'], $counts)) {
            $counts[$row['delivery_status']] = (int)$row['cnt'];
        }
    }

    sendSuccess([
        'deliveries' => $deliveries,
        'counts'     => $counts,
        'branch_id'  => $branchId,
    ]);
}

// ── POST: Create new delivery ─────────────────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $customerName    = trim($body['customer_name']    ?? '');
    $customerPhone   = trim($body['customer_phone']   ?? '');
    $customerAddress = trim($body['customer_address'] ?? '');
    $productId       = (int)($body['product_id']      ?? 0);
    $quantity        = (int)($body['quantity']         ?? 1);
    $assignedTo      = !empty($body['assigned_to']) ? (int)$body['assigned_to'] : null;
    $notes           = trim($body['notes']            ?? '');

    // Validation
    if (empty($customerName))    sendError('Customer name is required.');
    if (empty($customerAddress)) sendError('Delivery address is required.');
    if ($productId <= 0)         sendError('Please select a product.');
    if ($quantity  <= 0)         sendError('Quantity must be at least 1.');

    // Confirm product exists and belongs to branch
    $pStmt = $db->prepare("
        SELECT id, product_name, stock
        FROM products
        WHERE id = ? AND branch_id = ? AND status = 'Active'
    ");
    $pStmt->execute([$productId, $user['branch_id']]);
    $product = $pStmt->fetch();

    if (!$product) sendError('Product not found or inactive.');
    if ($product['stock'] < $quantity) {
        sendError("Not enough stock for \"{$product['product_name']}\". Available: {$product['stock']}.");
    }

    $stmt = $db->prepare("
        INSERT INTO deliveries
            (branch_id, customer_name, customer_phone, customer_address,
             product_id, quantity, delivery_status, assigned_to, notes,
             created_by, created_at)
        VALUES
            (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, NOW())
    ");
    $stmt->execute([
        $user['branch_id'],
        $customerName,
        $customerPhone,
        $customerAddress,
        $productId,
        $quantity,
        $assignedTo,
        $notes ?: null,
        $user['user_id'],
    ]);

    sendSuccess(['id' => (int)$db->lastInsertId()], 201);
}

// ── PUT: Full update (admin only) ─────────────────────────
if ($method === 'PUT' && $action !== 'status') {
    $deliveryId = (int)($_GET['id'] ?? 0);
    if (!$deliveryId) sendError('Delivery ID is required.');

    // Confirm ownership (must be in admin's branch)
    $check = $db->prepare("SELECT id, delivery_status, sale_confirmed FROM deliveries WHERE id = ? AND branch_id = ?");
    $check->execute([$deliveryId, $user['branch_id']]);
    $existingDelivery = $check->fetch();
    if (!$existingDelivery) sendError('Delivery not found or not in your branch.', 404);
    if ($existingDelivery['delivery_status'] === 'Delivered' || (int)$existingDelivery['sale_confirmed'] === 1) {
        sendError('Completed deliveries cannot be edited.');
    }

    $body = json_decode(file_get_contents('php://input'), true);

    $customerName    = trim($body['customer_name']    ?? '');
    $customerPhone   = trim($body['customer_phone']   ?? '');
    $customerAddress = trim($body['customer_address'] ?? '');
    $productId       = (int)($body['product_id']      ?? 0);
    $quantity        = (int)($body['quantity']         ?? 1);
    $assignedTo      = !empty($body['assigned_to']) ? (int)$body['assigned_to'] : null;
    $notes           = trim($body['notes']            ?? '');
    // Detail editing intentionally preserves the existing delivery status.
    $deliveryStatus = $existingDelivery['delivery_status'];
    if (empty($customerName))    sendError('Customer name is required.');
    if (empty($customerAddress)) sendError('Delivery address is required.');
    if ($productId <= 0)         sendError('Please select a product.');
    if ($quantity  <= 0)         sendError('Quantity must be at least 1.');

    $deliveredAt = 'NULL';

    $stmt = $db->prepare("
        UPDATE deliveries
        SET customer_name    = ?,
            customer_phone   = ?,
            customer_address = ?,
            product_id       = ?,
            quantity         = ?,
            delivery_status  = ?,
            assigned_to      = ?,
            notes            = ?,
            delivered_at     = $deliveredAt
        WHERE id = ? AND branch_id = ?
    ");
    $stmt->execute([
        $customerName,
        $customerPhone,
        $customerAddress,
        $productId,
        $quantity,
        $deliveryStatus,
        $assignedTo,
        $notes ?: null,
        $deliveryId,
        $user['branch_id'],
    ]);

    sendSuccess(['updated' => true, 'id' => $deliveryId]);
}

// ── PUT: Status-only update (deliverer + admin) ───────────
if ($method === 'PUT' && $action === 'status') {
    $deliveryId = (int)($_GET['id'] ?? 0);
    if (!$deliveryId) sendError('Delivery ID is required.');

    $body           = json_decode(file_get_contents('php://input'), true);
    $deliveryStatus = $body['delivery_status'] ?? '';

    $validStatuses = ['Pending', 'On the way', 'Delivered', 'Cancelled'];
    if (!in_array($deliveryStatus, $validStatuses)) {
        sendError('Invalid status value.');
    }

    $check = $db->prepare("
        SELECT id, delivery_status, sale_confirmed, assigned_to
        FROM deliveries
        WHERE id = ? AND branch_id = ?
    ");
    $check->execute([$deliveryId, $user['branch_id']]);
    $existingDelivery = $check->fetch();
    if (!$existingDelivery) sendError('Delivery not found or not in your branch.', 404);
    if ($user['role'] === 'deliverer' && (int)$existingDelivery['assigned_to'] !== (int)$user['user_id']) {
        sendError('Delivery not found or not assigned to you.', 403);
    }
    if ($existingDelivery['delivery_status'] === 'Delivered' || (int)$existingDelivery['sale_confirmed'] === 1) {
        sendError('This delivery has already been completed. No additional sale was created.');
    }

    if ($deliveryStatus === 'Delivered') {
        try {
            $sale = completeDelivery($db, $deliveryId, $user);
            sendSuccess([
                'updated'         => true,
                'id'              => $deliveryId,
                'delivery_status' => $deliveryStatus,
            ] + $sale);
        } catch (Throwable $e) {
            sendError($e->getMessage());
        }
    }

    $deliveredAt = 'NULL';

    $stmt = $db->prepare("
        UPDATE deliveries
        SET delivery_status = ?,
            delivered_at    = $deliveredAt
        WHERE id = ?
    ");
    $stmt->execute([$deliveryStatus, $deliveryId]);

    sendSuccess(['updated' => true, 'id' => $deliveryId, 'delivery_status' => $deliveryStatus]);
}

// ── DELETE: Cancel delivery (sets status = Cancelled) ─────
if ($method === 'DELETE') {
    $deliveryId = (int)($_GET['id'] ?? 0);
    if (!$deliveryId) sendError('Delivery ID is required.');

    $check = $db->prepare("SELECT id, delivery_status, sale_confirmed FROM deliveries WHERE id = ? AND branch_id = ?");
    $check->execute([$deliveryId, $user['branch_id']]);
    $delivery = $check->fetch();
    if (!$delivery) sendError('Delivery not found or not in your branch.', 404);
    if ($delivery['delivery_status'] === 'Delivered' || (int)$delivery['sale_confirmed'] === 1) {
        sendError('Completed deliveries cannot be cancelled.');
    }

    $stmt = $db->prepare("
        UPDATE deliveries SET delivery_status = 'Cancelled' WHERE id = ?
    ");
    $stmt->execute([$deliveryId]);

    sendSuccess(['cancelled' => true, 'id' => $deliveryId]);
}

sendError('Method not allowed.', 405);

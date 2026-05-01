<?php
// File: api/sales/index.php
// Place in: /api/sales/index.php
// Handles all sales operations. This file generates reference numbers
// automatically so the cashier never has to think about them.

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

$method = $_SERVER['REQUEST_METHOD'];
$user   = requireAuth(['admin', 'employee']);
$db     = getDB();

if ($method === 'GET') {

    // Single sale with full item breakdown
    if (isset($_GET['id'])) {
        $saleId = (int)$_GET['id'];

        $stmt = $db->prepare("
            SELECT s.id, s.reference_no, s.branch_id, s.total_amount,
                   s.amount_tendered, s.change_amount, s.sale_type,
                   s.sale_date, s.created_by,
                   u.full_name AS cashier_name
            FROM sales s
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.id = ? AND s.branch_id = ?
        ");
        $stmt->execute([$saleId, $user['branch_id']]);
        $sale = $stmt->fetch();
        if (!$sale) sendError('Sale not found.', 404);

        $itemStmt = $db->prepare("
            SELECT si.quantity, si.unit_price, si.subtotal,
                   p.product_name, p.category
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            WHERE si.sale_id = ?
        ");
        $itemStmt->execute([$saleId]);
        $sale['items'] = $itemStmt->fetchAll();

        sendSuccess($sale);
    }

    // Search by reference number
    if (!empty($_GET['ref_search'])) {
        $branchId  = $user['branch_id'];
        $refSearch = '%' . $_GET['ref_search'] . '%';

        $stmt = $db->prepare("
            SELECT s.id, s.reference_no, s.total_amount, s.sale_type,
                   s.sale_date, u.full_name AS cashier_name
            FROM sales s
            LEFT JOIN users u ON u.id = s.created_by
            WHERE s.branch_id = ? AND s.reference_no LIKE ?
            ORDER BY s.sale_date DESC
            LIMIT 50
        ");
        $stmt->execute([$branchId, $refSearch]);
        sendSuccess(['sales' => $stmt->fetchAll()]);
    }

    // Date-filtered list with branch support
    $branchId = isset($_GET['branch_id'])
        ? (int)$_GET['branch_id']
        : $user['branch_id'];

    requireBranchAccess($user, $branchId, 'read');

    $dateFrom = $_GET['date_from'] ?? date('Y-m-01');
    $dateTo   = $_GET['date_to']   ?? date('Y-m-d');

    // Employee only sees today and only their branch
    if ($user['role'] === 'employee') {
        $dateFrom = date('Y-m-d');
        $dateTo   = date('Y-m-d');
        $branchId = $user['branch_id'];
    }

    $stmt = $db->prepare("
        SELECT s.id, s.reference_no, s.total_amount, s.amount_tendered,
               s.change_amount, s.sale_type, s.sale_date,
               u.full_name AS cashier_name
        FROM sales s
        LEFT JOIN users u ON u.id = s.created_by
        WHERE s.branch_id = ?
          AND DATE(s.sale_date) BETWEEN ? AND ?
        ORDER BY s.sale_date DESC
        LIMIT 300
    ");
    $stmt->execute([$branchId, $dateFrom, $dateTo]);
    $sales = $stmt->fetchAll();

    $totStmt = $db->prepare("
        SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total
        FROM sales
        WHERE branch_id = ? AND DATE(sale_date) BETWEEN ? AND ?
    ");
    $totStmt->execute([$branchId, $dateFrom, $dateTo]);
    $totals = $totStmt->fetch();

    sendSuccess([
        'sales'     => $sales,
        'count'     => (int)$totals['count'],
        'total'     => (float)$totals['total'],
        'date_from' => $dateFrom,
        'date_to'   => $dateTo,
        'branch_id' => $branchId,
    ]);
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $items          = $body['items']            ?? [];
    $amountTendered = (float)($body['amount_tendered'] ?? 0);
    $saleType       = in_array($body['sale_type'] ?? '', ['walk-in','delivery','exchange'])
                        ? $body['sale_type'] : 'walk-in';

    if (empty($items))        sendError('Cart is empty.');
    if ($amountTendered <= 0) sendError('Amount tendered must be greater than zero.');

    $totalAmount = 0;
    $lineItems   = [];

    foreach ($items as $item) {
        $productId = (int)($item['product_id'] ?? 0);
        $quantity  = (int)($item['quantity']   ?? 0);
        // exchange_price is sent from frontend when sale_type is 'exchange'
        $useExchangePrice = ($saleType === 'exchange') && !empty($item['use_exchange']);

        if ($productId <= 0 || $quantity <= 0) sendError('Invalid item in cart.');

        $pStmt = $db->prepare("
            SELECT id, product_name, price, exchange_price, stock
            FROM products
            WHERE id = ? AND branch_id = ? AND status = 'Active'
        ");
        $pStmt->execute([$productId, $user['branch_id']]);
        $product = $pStmt->fetch();

        if (!$product) sendError("Product ID $productId not found.");
        if ($product['stock'] < $quantity) {
            sendError("Not enough stock for \"{$product['product_name']}\". Available: {$product['stock']}.");
        }

        // Use exchange price if available and selected, otherwise regular price
        $unitPrice = ($useExchangePrice && $product['exchange_price'])
            ? (float)$product['exchange_price']
            : (float)$product['price'];

        $subtotal     = $unitPrice * $quantity;
        $totalAmount += $subtotal;

        $lineItems[] = [
            'product_id' => $productId,
            'quantity'   => $quantity,
            'unit_price' => $unitPrice,
            'subtotal'   => $subtotal,
            'stock'      => $product['stock'],
        ];
    }

    if ($amountTendered < $totalAmount) {
        sendError(sprintf('Amount tendered (₱%.2f) is less than total (₱%.2f).', $amountTendered, $totalAmount));
    }

    $changeAmount = $amountTendered - $totalAmount;

    // Generate unique reference number: BOMS-YYYYMMDD-XXXX
    // We use a loop in case of the rare same-second collision
    $referenceNo = null;
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $candidate = 'BOMS-' . date('Ymd') . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT);
        $checkRef  = $db->prepare("SELECT id FROM sales WHERE reference_no = ?");
        $checkRef->execute([$candidate]);
        if (!$checkRef->fetch()) {
            $referenceNo = $candidate;
            break;
        }
    }
    if (!$referenceNo) sendError('Could not generate reference number. Try again.', 500);

    $db->beginTransaction();
    try {
        $saleStmt = $db->prepare("
            INSERT INTO sales
                (reference_no, branch_id, total_amount, amount_tendered,
                 change_amount, sale_type, created_by, sale_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $saleStmt->execute([
            $referenceNo,
            $user['branch_id'],
            $totalAmount,
            $amountTendered,
            $changeAmount,
            $saleType,
            $user['user_id'],
        ]);
        $saleId = (int)$db->lastInsertId();

        $itemStmt  = $db->prepare("
            INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stockStmt = $db->prepare("
            UPDATE products SET stock = stock - ? WHERE id = ?
        ");

        foreach ($lineItems as $li) {
            $itemStmt->execute([$saleId, $li['product_id'], $li['quantity'], $li['unit_price'], $li['subtotal']]);
            $stockStmt->execute([$li['quantity'], $li['product_id']]);
        }

        $db->commit();

        sendSuccess([
            'sale_id'        => $saleId,
            'reference_no'   => $referenceNo,
            'total_amount'   => $totalAmount,
            'amount_tendered'=> $amountTendered,
            'change_amount'  => $changeAmount,
            'sale_type'      => $saleType,
        ], 201);

    } catch (Exception $e) {
        $db->rollBack();
        sendError('Sale could not be saved. Please try again.', 500);
    }
}

sendError('Method not allowed.', 405);
<?php
// ============================================================
// FILE: api/expenses/index.php
// PLACE IN: /api/expenses/index.php
//
// ROUTES:
//   GET    ?branch_id=1&date_from=Y-m-d&date_to=Y-m-d → list expenses
//   POST                                               → add expense
//   PUT    ?id=5                                       → edit expense
//   DELETE ?id=5                                       → delete expense
//
// ACCESS: admin only
//
// DB COLUMNS (match expenses_update.sql exactly):
//   id, branch_id, category, description,
//   amount, expense_date, created_by, created_at
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

$user   = requireAuth('admin');
$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: List expenses ─────────────────────────────────────
if ($method === 'GET') {
    $branchId  = isset($_GET['branch_id'])
        ? (int)$_GET['branch_id']
        : $user['branch_id'];

    requireBranchAccess($user, $branchId, 'read');

    $dateFrom = $_GET['date_from'] ?? date('Y-m-01');
    $dateTo   = $_GET['date_to']   ?? date('Y-m-d');

    $stmt = $db->prepare("
        SELECT
            e.id, e.branch_id, e.category, e.description,
            e.amount, e.expense_date, e.created_at,
            u.full_name AS created_by_name
        FROM expenses e
        LEFT JOIN users u ON u.id = e.created_by
        WHERE e.branch_id = ?
          AND e.expense_date BETWEEN ? AND ?
        ORDER BY e.expense_date DESC, e.created_at DESC
    ");
    $stmt->execute([$branchId, $dateFrom, $dateTo]);
    $expenses = $stmt->fetchAll();

    // Total for the period
    $totStmt = $db->prepare("
        SELECT
            COALESCE(SUM(amount), 0) AS total,
            COUNT(*)                 AS count
        FROM expenses
        WHERE branch_id    = ?
          AND expense_date BETWEEN ? AND ?
    ");
    $totStmt->execute([$branchId, $dateFrom, $dateTo]);
    $totals = $totStmt->fetch();

    // Per-category breakdown
    $catStmt = $db->prepare("
        SELECT category, COALESCE(SUM(amount), 0) AS subtotal
        FROM expenses
        WHERE branch_id    = ?
          AND expense_date BETWEEN ? AND ?
        GROUP BY category
        ORDER BY subtotal DESC
    ");
    $catStmt->execute([$branchId, $dateFrom, $dateTo]);
    $byCategory = $catStmt->fetchAll();

    sendSuccess([
        'expenses'    => $expenses,
        'count'       => (int)$totals['count'],
        'total'       => (float)$totals['total'],
        'by_category' => $byCategory,
        'date_from'   => $dateFrom,
        'date_to'     => $dateTo,
        'branch_id'   => $branchId,
    ]);
}

// ── POST: Add new expense ──────────────────────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $category    = trim($body['category']    ?? 'Other');
    $description = trim($body['description'] ?? '');
    $amount      = (float)($body['amount']      ?? 0);
    $expenseDate = trim($body['expense_date'] ?? '');

    if (empty($description)) sendError('Description is required.');
    if ($amount <= 0)        sendError('Amount must be greater than zero.');
    if (empty($expenseDate)) sendError('Expense date is required.');
    if (!strtotime($expenseDate)) sendError('Invalid date format.');

    $stmt = $db->prepare("
        INSERT INTO expenses
            (branch_id, category, description, amount, expense_date, created_by)
        VALUES
            (?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $user['branch_id'],
        $category,
        $description,
        $amount,
        $expenseDate,
        $user['user_id'],
    ]);

    sendSuccess(['id' => (int)$db->lastInsertId()], 201);
}

// ── PUT: Edit expense ──────────────────────────────────────
if ($method === 'PUT') {
    $expenseId = (int)($_GET['id'] ?? 0);
    if (!$expenseId) sendError('Expense ID is required.');

    $check = $db->prepare("SELECT id FROM expenses WHERE id = ? AND branch_id = ?");
    $check->execute([$expenseId, $user['branch_id']]);
    if (!$check->fetch()) sendError('Expense not found or not in your branch.', 404);

    $body = json_decode(file_get_contents('php://input'), true);

    $category    = trim($body['category']    ?? 'Other');
    $description = trim($body['description'] ?? '');
    $amount      = (float)($body['amount']      ?? 0);
    $expenseDate = trim($body['expense_date'] ?? '');

    if (empty($description)) sendError('Description is required.');
    if ($amount <= 0)        sendError('Amount must be greater than zero.');
    if (empty($expenseDate)) sendError('Expense date is required.');
    if (!strtotime($expenseDate)) sendError('Invalid date format.');

    $stmt = $db->prepare("
        UPDATE expenses
        SET category    = ?,
            description = ?,
            amount      = ?,
            expense_date = ?
        WHERE id = ? AND branch_id = ?
    ");
    $stmt->execute([
        $category, $description, $amount,
        $expenseDate, $expenseId, $user['branch_id'],
    ]);

    sendSuccess(['updated' => true, 'id' => $expenseId]);
}

// ── DELETE: Remove expense ─────────────────────────────────
if ($method === 'DELETE') {
    $expenseId = (int)($_GET['id'] ?? 0);
    if (!$expenseId) sendError('Expense ID is required.');

    $check = $db->prepare("SELECT id FROM expenses WHERE id = ? AND branch_id = ?");
    $check->execute([$expenseId, $user['branch_id']]);
    if (!$check->fetch()) sendError('Expense not found or not in your branch.', 404);

    $stmt = $db->prepare("DELETE FROM expenses WHERE id = ?");
    $stmt->execute([$expenseId]);

    sendSuccess(['deleted' => true, 'id' => $expenseId]);
}

sendError('Method not allowed.', 405);
<?php
// ============================================================
// FILE: api/reports/index.php
// PLACE IN: /api/reports/index.php
//
// ROUTES (all GET, distinguished by ?type=):
//   GET ?type=sales     &branch_id=N&date_from=Y-m-d&date_to=Y-m-d
//   GET ?type=expenses  &branch_id=N&date_from=Y-m-d&date_to=Y-m-d
//   GET ?type=payroll   &branch_id=N&period_start=Y-m-d&period_end=Y-m-d
//   GET ?type=inventory &branch_id=N
//   GET ?type=summary   &branch_id=N&date_from=Y-m-d&date_to=Y-m-d
//     → summary returns all KPIs in one call (used by the report overview)
//
// ACCESS: admin only
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

$user   = requireAuth('admin');
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') sendError('Method not allowed.', 405);

$db         = getDB();
$type       = $_GET['type']    ?? '';
$branchId   = isset($_GET['branch_id'])
    ? (int)$_GET['branch_id']
    : $user['branch_id'];

requireBranchAccess($user, $branchId, 'read');

// ── Helper: validate and default dates ─────────────────────
$dateFrom    = $_GET['date_from']    ?? date('Y-m-01');
$dateTo      = $_GET['date_to']      ?? date('Y-m-d');
$periodStart = $_GET['period_start'] ?? date('Y-m-01');
$periodEnd   = $_GET['period_end']   ?? date('Y-m-t');

// ── REPORT TYPE: sales ─────────────────────────────────────
if ($type === 'sales') {

    // Total revenue + transaction count
    $totStmt = $db->prepare("
        SELECT
            COUNT(*)                          AS total_transactions,
            COALESCE(SUM(total_amount), 0)    AS total_revenue,
            COALESCE(AVG(total_amount), 0)    AS avg_per_sale,
            COALESCE(MAX(total_amount), 0)    AS highest_sale
        FROM sales
        WHERE branch_id = ?
          AND DATE(sale_date) BETWEEN ? AND ?
    ");
    $totStmt->execute([$branchId, $dateFrom, $dateTo]);
    $totals = $totStmt->fetch();

    // Monthly breakdown
    $monthStmt = $db->prepare("
        SELECT
            DATE_FORMAT(sale_date, '%b %Y')   AS month_label,
            DATE_FORMAT(sale_date, '%Y-%m')   AS month_sort,
            COUNT(*)                          AS transactions,
            COALESCE(SUM(total_amount), 0)    AS revenue
        FROM sales
        WHERE branch_id = ?
          AND DATE(sale_date) BETWEEN ? AND ?
        GROUP BY month_sort, month_label
        ORDER BY month_sort ASC
    ");
    $monthStmt->execute([$branchId, $dateFrom, $dateTo]);
    $monthly = $monthStmt->fetchAll();

    // Top selling products (by quantity sold)
    $topStmt = $db->prepare("
        SELECT
            p.product_name,
            SUM(si.quantity)   AS total_qty,
            SUM(si.subtotal)   AS total_revenue
        FROM sale_items si
        JOIN sales    s ON s.id = si.sale_id
        JOIN products p ON p.id = si.product_id
        WHERE s.branch_id = ?
          AND DATE(s.sale_date) BETWEEN ? AND ?
        GROUP BY p.id, p.product_name
        ORDER BY total_qty DESC
        LIMIT 5
    ");
    $topStmt->execute([$branchId, $dateFrom, $dateTo]);
    $topProducts = $topStmt->fetchAll();

    sendSuccess([
        'type'         => 'sales',
        'branch_id'    => $branchId,
        'date_from'    => $dateFrom,
        'date_to'      => $dateTo,
        'totals'       => $totals,
        'monthly'      => $monthly,
        'top_products' => $topProducts,
    ]);
}

// ── REPORT TYPE: expenses ──────────────────────────────────
if ($type === 'expenses') {

    $totStmt = $db->prepare("
        SELECT
            COUNT(*)                       AS total_entries,
            COALESCE(SUM(amount), 0)       AS total_expenses,
            COALESCE(AVG(amount), 0)       AS avg_expense,
            COALESCE(MAX(amount), 0)       AS highest_expense
        FROM expenses
        WHERE branch_id    = ?
          AND expense_date BETWEEN ? AND ?
    ");
    $totStmt->execute([$branchId, $dateFrom, $dateTo]);
    $totals = $totStmt->fetch();

    // By category
    $catStmt = $db->prepare("
        SELECT
            category,
            COUNT(*)                 AS entries,
            COALESCE(SUM(amount), 0) AS subtotal
        FROM expenses
        WHERE branch_id    = ?
          AND expense_date BETWEEN ? AND ?
        GROUP BY category
        ORDER BY subtotal DESC
    ");
    $catStmt->execute([$branchId, $dateFrom, $dateTo]);
    $byCategory = $catStmt->fetchAll();

    // Monthly breakdown
    $monthStmt = $db->prepare("
        SELECT
            DATE_FORMAT(expense_date, '%b %Y') AS month_label,
            DATE_FORMAT(expense_date, '%Y-%m') AS month_sort,
            COALESCE(SUM(amount), 0)           AS total
        FROM expenses
        WHERE branch_id    = ?
          AND expense_date BETWEEN ? AND ?
        GROUP BY month_sort, month_label
        ORDER BY month_sort ASC
    ");
    $monthStmt->execute([$branchId, $dateFrom, $dateTo]);
    $monthly = $monthStmt->fetchAll();

    sendSuccess([
        'type'        => 'expenses',
        'branch_id'   => $branchId,
        'date_from'   => $dateFrom,
        'date_to'     => $dateTo,
        'totals'      => $totals,
        'by_category' => $byCategory,
        'monthly'     => $monthly,
    ]);
}

// ── REPORT TYPE: payroll ───────────────────────────────────
if ($type === 'payroll') {

    $totStmt = $db->prepare("
        SELECT
            COUNT(*)                          AS employee_count,
            COALESCE(SUM(gross_pay),  0)      AS total_gross,
            COALESCE(SUM(deductions), 0)      AS total_deductions,
            COALESCE(SUM(net_pay),    0)      AS total_net
        FROM payroll
        WHERE branch_id   = ?
          AND period_start = ?
          AND period_end   = ?
    ");
    $totStmt->execute([$branchId, $periodStart, $periodEnd]);
    $totals = $totStmt->fetch();

    // Per-employee breakdown
    $empStmt = $db->prepare("
        SELECT
            e.full_name         AS employee_name,
            e.position          AS employee_position,
            p.days_worked,
            p.daily_rate,
            p.gross_pay,
            p.deductions,
            p.net_pay,
            p.status
        FROM payroll p
        JOIN employees e ON e.id = p.employee_id
        WHERE p.branch_id   = ?
          AND p.period_start = ?
          AND p.period_end   = ?
        ORDER BY e.full_name ASC
    ");
    $empStmt->execute([$branchId, $periodStart, $periodEnd]);
    $records = $empStmt->fetchAll();

    sendSuccess([
        'type'         => 'payroll',
        'branch_id'    => $branchId,
        'period_start' => $periodStart,
        'period_end'   => $periodEnd,
        'totals'       => $totals,
        'records'      => $records,
    ]);
}

// ── REPORT TYPE: inventory ─────────────────────────────────
if ($type === 'inventory') {

    $summaryStmt = $db->prepare("
        SELECT
            COUNT(*)                                              AS total_products,
            SUM(CASE WHEN stock = 0      THEN 1 ELSE 0 END)      AS out_of_stock,
            SUM(CASE WHEN stock <= 5
                      AND stock  > 0    THEN 1 ELSE 0 END)       AS low_stock,
            SUM(CASE WHEN stock  > 5    THEN 1 ELSE 0 END)       AS ok_stock,
            COALESCE(SUM(stock), 0)                              AS total_units,
            COALESCE(SUM(stock * price), 0)                      AS stock_value
        FROM products
        WHERE branch_id = ? AND status = 'Active'
    ");
    $summaryStmt->execute([$branchId]);
    $summary = $summaryStmt->fetch();

    // Full product list with stock level
    $prodStmt = $db->prepare("
        SELECT
            product_name, category, stock, price,
            (stock * price) AS stock_value
        FROM products
        WHERE branch_id = ? AND status = 'Active'
        ORDER BY stock ASC, product_name ASC
    ");
    $prodStmt->execute([$branchId]);
    $products = $prodStmt->fetchAll();

    sendSuccess([
        'type'      => 'inventory',
        'branch_id' => $branchId,
        'summary'   => $summary,
        'products'  => $products,
    ]);
}

// ── REPORT TYPE: summary (overview tab) ───────────────────
if ($type === 'summary') {

    // Revenue
    $salesStmt = $db->prepare("
        SELECT COALESCE(SUM(total_amount), 0) AS revenue
        FROM sales
        WHERE branch_id = ? AND DATE(sale_date) BETWEEN ? AND ?
    ");
    $salesStmt->execute([$branchId, $dateFrom, $dateTo]);
    $revenue = (float)$salesStmt->fetch()['revenue'];

    // Expenses
    $expStmt = $db->prepare("
        SELECT COALESCE(SUM(amount), 0) AS expenses
        FROM expenses
        WHERE branch_id = ? AND expense_date BETWEEN ? AND ?
    ");
    $expStmt->execute([$branchId, $dateFrom, $dateTo]);
    $expenses = (float)$expStmt->fetch()['expenses'];

    // Net income = revenue - expenses
    $netIncome = $revenue - $expenses;

    // Active employees
    $empStmt = $db->prepare("
        SELECT COUNT(*) AS count FROM employees
        WHERE branch_id = ? AND status = 'Active'
    ");
    $empStmt->execute([$branchId]);
    $activeEmployees = (int)$empStmt->fetch()['count'];

    // Pending deliveries
    $delStmt = $db->prepare("
        SELECT COUNT(*) AS count FROM deliveries
        WHERE branch_id = ? AND delivery_status = 'Pending'
    ");
    $delStmt->execute([$branchId]);
    $pendingDeliveries = (int)$delStmt->fetch()['count'];

    // Low stock count
    $stockStmt = $db->prepare("
        SELECT COUNT(*) AS count FROM products
        WHERE branch_id = ? AND status = 'Active' AND stock <= 5
    ");
    $stockStmt->execute([$branchId]);
    $lowStock = (int)$stockStmt->fetch()['count'];

    // Monthly sales chart data
    $chartStmt = $db->prepare("
        SELECT
            DATE_FORMAT(sale_date, '%b %Y') AS month_label,
            DATE_FORMAT(sale_date, '%Y-%m') AS month_sort,
            COALESCE(SUM(total_amount), 0)  AS revenue
        FROM sales
        WHERE branch_id = ?
          AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY month_sort, month_label
        ORDER BY month_sort ASC
    ");
    $chartStmt->execute([$branchId]);
    $chartData = $chartStmt->fetchAll();

    sendSuccess([
        'type'               => 'summary',
        'branch_id'          => $branchId,
        'date_from'          => $dateFrom,
        'date_to'            => $dateTo,
        'revenue'            => $revenue,
        'expenses'           => $expenses,
        'net_income'         => $netIncome,
        'active_employees'   => $activeEmployees,
        'pending_deliveries' => $pendingDeliveries,
        'low_stock'          => $lowStock,
        'chart_labels'       => array_column($chartData, 'month_label'),
        'chart_revenue'      => array_map('floatval', array_column($chartData, 'revenue')),
    ]);
}

sendError('Invalid report type. Use: sales, expenses, payroll, inventory, or summary.', 400);
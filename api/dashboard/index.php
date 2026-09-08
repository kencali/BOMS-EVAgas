<?php
// ============================================================
// FILE: api/dashboard/index.php
// METHOD: GET
// ACCESS: admin only
// PURPOSE: Returns all dashboard stats as JSON.
//          This replaces all the PHP queries that were
//          sitting inside the old dashboard.php HTML file.
//
// The frontend calls: GET /api/dashboard/index.php?branch_id=1
// Optional:           GET /api/dashboard/index.php?branch_id=2
//                     (other branch — read-only analytics)
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

// Only admin can see the dashboard stats
$user = requireAuth('admin');

$db = getDB();

// Which branch to query?
// Default = their own branch. They can pass ?branch_id=2 to see the other.
$requestedBranch = isset($_GET['branch_id']) ? (int)$_GET['branch_id'] : $user['branch_id'];

// Enforce branch access rule:
// Own branch = full data. Other branch = allowed (read-only, handled by frontend).
requireBranchAccess($user, $requestedBranch, 'read');

// ── STAT 1: Total Sales ───────────────────────────────────
$stmt = $db->prepare("SELECT COALESCE(SUM(total_amount), 0) AS total FROM sales WHERE branch_id = ?");
$stmt->execute([$requestedBranch]);
$total_sales = (float)$stmt->fetch()['total'];

// ── STAT 2: Today's Sales ─────────────────────────────────
$stmt = $db->prepare("\n    SELECT COALESCE(SUM(total_amount), 0) AS total\n    FROM sales\n    WHERE branch_id = ?\n      AND sale_date >= CURDATE()\n      AND sale_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY)\n");
$stmt->execute([$requestedBranch]);
$today_sales = (float)$stmt->fetch()['total'];

// ── STAT 3: Total Products ────────────────────────────────
$stmt = $db->prepare("SELECT COUNT(*) AS total FROM products WHERE branch_id = ?");
$stmt->execute([$requestedBranch]);
$total_products = (int)$stmt->fetch()['total'];

// ── STAT 3: Active Employees ──────────────────────────────
$stmt = $db->prepare("SELECT COUNT(*) AS total FROM employees WHERE branch_id = ? AND status = 'Active'");
$stmt->execute([$requestedBranch]);
$total_employees = (int)$stmt->fetch()['total'];

// ── STAT 4: Pending Deliveries ────────────────────────────
$stmt = $db->prepare("SELECT COUNT(*) AS total FROM deliveries WHERE branch_id = ? AND delivery_status = 'Pending'");
$stmt->execute([$requestedBranch]);
$total_pending = (int)$stmt->fetch()['total'];

// ── STAT 5: Total Expenses ────────────────────────────────
$stmt = $db->prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE branch_id = ?");
$stmt->execute([$requestedBranch]);
$total_expenses = (float)$stmt->fetch()['total'];

// ── STAT 6: Net Income (calculated, not stored) ───────────
$net_income = $total_sales - $total_expenses;

// ── STAT 7: Monthly Sales Chart Data ─────────────────────
// Returns last 12 months so the chart doesn't get too wide
$stmt = $db->prepare("
    SELECT 
        DATE_FORMAT(sale_date, '%b %Y') AS month_label,
        DATE_FORMAT(sale_date, '%Y-%m') AS month_sort,
        COALESCE(SUM(total_amount), 0)  AS total
    FROM sales
    WHERE branch_id = ?
      AND sale_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    GROUP BY month_sort, month_label
    ORDER BY month_sort ASC
");
$stmt->execute([$requestedBranch]);
$monthly_rows = $stmt->fetchAll();

$monthly_labels = array_column($monthly_rows, 'month_label');
$monthly_totals = array_map('floatval', array_column($monthly_rows, 'total'));

// ── STAT 8: Low Stock Products (bonus — useful for admin) ─
$stmt = $db->prepare("
    SELECT product_name, stock 
    FROM products 
    WHERE branch_id = ? AND stock <= 5
    ORDER BY stock ASC
    LIMIT 5
");
$stmt->execute([$requestedBranch]);
$low_stock = $stmt->fetchAll();

// ── Send everything in one response ──────────────────────
sendSuccess([
    'branch_id'      => $requestedBranch,
    'is_own_branch'  => ($requestedBranch === $user['branch_id']),
    'stats' => [
        'total_sales'     => $total_sales,
        'today_sales'     => $today_sales,
        'total_products'  => $total_products,
        'total_employees' => $total_employees,
        'total_pending'   => $total_pending,
        'total_expenses'  => $total_expenses,
        'net_income'      => $net_income,
    ],
    'chart' => [
        'labels' => $monthly_labels,
        'totals' => $monthly_totals,
    ],
    'low_stock' => $low_stock,
]);

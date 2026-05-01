<?php
// ============================================================
// FILE: api/payroll/index.php
// PLACE IN: /api/payroll/index.php
//
// ROUTES:
//   GET  ?branch_id=1&period_start=Y-m-d&period_end=Y-m-d → list payroll
//   GET  ?summary=1&branch_id=1                           → period totals
//   POST                                                  → compute payroll batch
//   PUT  ?id=5&action=release                             → release one record
//   PUT  ?action=release_all&branch_id=1                  → release all Draft in period
//   DELETE ?id=5                                          → delete Draft record
//
// ACCESS: admin only
//
// PAYROLL FORMULA (matches Philippines daily-rate practice):
//   gross_pay = days_worked × daily_rate
//   net_pay   = gross_pay  - deductions
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

$user   = requireAuth('admin');
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$db     = getDB();

// ── GET: List payroll records or summary ───────────────────
if ($method === 'GET') {
    $branchId    = isset($_GET['branch_id'])
        ? (int)$_GET['branch_id']
        : $user['branch_id'];

    requireBranchAccess($user, $branchId, 'read');

    // Summary totals only (for dashboard widget)
    if (isset($_GET['summary'])) {
        $periodStart = $_GET['period_start'] ?? date('Y-m-01');
        $periodEnd   = $_GET['period_end']   ?? date('Y-m-t');

        $stmt = $db->prepare("
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
        $stmt->execute([$branchId, $periodStart, $periodEnd]);
        sendSuccess($stmt->fetch());
    }

    // Full list for a period
    $periodStart = $_GET['period_start'] ?? date('Y-m-01');
    $periodEnd   = $_GET['period_end']   ?? date('Y-m-t');

    $stmt = $db->prepare("
        SELECT
            p.id,
            p.branch_id,
            p.employee_id,
            p.period_start,
            p.period_end,
            p.days_worked,
            p.daily_rate,
            p.gross_pay,
            p.deductions,
            p.net_pay,
            p.status,
            p.created_at,
            e.full_name   AS employee_name,
            e.position    AS employee_position
        FROM payroll p
        JOIN employees e ON e.id = p.employee_id
        WHERE p.branch_id   = ?
          AND p.period_start = ?
          AND p.period_end   = ?
        ORDER BY e.full_name ASC
    ");
    $stmt->execute([$branchId, $periodStart, $periodEnd]);
    $records = $stmt->fetchAll();

    // Per-period totals
    $totStmt = $db->prepare("
        SELECT
            COALESCE(SUM(gross_pay),  0) AS total_gross,
            COALESCE(SUM(deductions), 0) AS total_deductions,
            COALESCE(SUM(net_pay),    0) AS total_net
        FROM payroll
        WHERE branch_id   = ?
          AND period_start = ?
          AND period_end   = ?
    ");
    $totStmt->execute([$branchId, $periodStart, $periodEnd]);
    $totals = $totStmt->fetch();

    sendSuccess([
        'records'      => $records,
        'count'        => count($records),
        'totals'       => $totals,
        'period_start' => $periodStart,
        'period_end'   => $periodEnd,
        'branch_id'    => $branchId,
    ]);
}

// ── POST: Compute payroll batch for a period ───────────────
// Creates one payroll record per active employee.
// If a record already exists for that employee + period, skip it
// (prevents duplicates — admin can rerun safely).
if ($method === 'POST') {
    $body        = json_decode(file_get_contents('php://input'), true);
    $periodStart = trim($body['period_start'] ?? '');
    $periodEnd   = trim($body['period_end']   ?? '');
    $daysWorked  = (float)($body['days_worked'] ?? 0);

    if (empty($periodStart) || empty($periodEnd)) {
        sendError('Period start and end dates are required.');
    }
    if ($daysWorked <= 0 || $daysWorked > 31) {
        sendError('Days worked must be between 0.5 and 31.');
    }

    // Validate dates
    if (!strtotime($periodStart) || !strtotime($periodEnd)) {
        sendError('Invalid date format. Use YYYY-MM-DD.');
    }
    if ($periodStart > $periodEnd) {
        sendError('Period start must be before period end.');
    }

    // Fetch all active employees for this branch
    $empStmt = $db->prepare("
        SELECT id, full_name, daily_rate
        FROM employees
        WHERE branch_id = ? AND status = 'Active'
        ORDER BY full_name ASC
    ");
    $empStmt->execute([$user['branch_id']]);
    $employees = $empStmt->fetchAll();

    if (empty($employees)) {
        sendError('No active employees found for this branch.');
    }

    $insertStmt = $db->prepare("
        INSERT IGNORE INTO payroll
            (branch_id, employee_id, period_start, period_end,
             days_worked, daily_rate, gross_pay, deductions, net_pay,
             status, created_by)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, 0, ?, 'Draft', ?)
    ");
    // Note: deductions default to 0 — admin edits individually via PUT
    // INSERT IGNORE skips if unique key already exists (no duplicate)

    $created = 0;
    $skipped = 0;

    // Check for existing records before inserting
    $checkStmt = $db->prepare("
        SELECT id FROM payroll
        WHERE employee_id = ? AND period_start = ? AND period_end = ?
    ");

    foreach ($employees as $emp) {
        $checkStmt->execute([$emp['id'], $periodStart, $periodEnd]);
        if ($checkStmt->fetch()) {
            $skipped++;
            continue; // already computed for this employee + period
        }

        $grossPay = round($daysWorked * (float)$emp['daily_rate'], 2);
        $netPay   = $grossPay; // deductions = 0 at creation

        $insertStmt->execute([
            $user['branch_id'],
            $emp['id'],
            $periodStart,
            $periodEnd,
            $daysWorked,
            (float)$emp['daily_rate'],
            $grossPay,
            $netPay,
            $user['user_id'],
        ]);
        $created++;
    }

    sendSuccess([
        'computed' => true,
        'created'  => $created,
        'skipped'  => $skipped,
        'message'  => "$created payroll record(s) created. $skipped already existed.",
    ], 201);
}

// ── PUT: Update one record (edit deductions) or release ────
if ($method === 'PUT') {
    $payrollId = (int)($_GET['id'] ?? 0);
    $body      = json_decode(file_get_contents('php://input'), true);

    // Release ALL draft records for a period
    if ($action === 'release_all') {
        $periodStart = $body['period_start'] ?? '';
        $periodEnd   = $body['period_end']   ?? '';

        if (empty($periodStart) || empty($periodEnd)) {
            sendError('period_start and period_end are required.');
        }

        $stmt = $db->prepare("
            UPDATE payroll
            SET status = 'Released'
            WHERE branch_id   = ?
              AND period_start = ?
              AND period_end   = ?
              AND status       = 'Draft'
        ");
        $stmt->execute([$user['branch_id'], $periodStart, $periodEnd]);
        sendSuccess(['released' => $stmt->rowCount()]);
    }

    // Release or edit single record
    if (!$payrollId) sendError('Payroll ID is required.');

    $check = $db->prepare("
        SELECT id, status FROM payroll WHERE id = ? AND branch_id = ?
    ");
    $check->execute([$payrollId, $user['branch_id']]);
    $record = $check->fetch();
    if (!$record) sendError('Payroll record not found.', 404);

    // Release single record
    if ($action === 'release') {
        if ($record['status'] === 'Released') {
            sendError('Record is already released.');
        }
        $stmt = $db->prepare("
            UPDATE payroll SET status = 'Released' WHERE id = ?
        ");
        $stmt->execute([$payrollId]);
        sendSuccess(['released' => true, 'id' => $payrollId]);
    }

    // Edit deductions (only allowed on Draft records)
    if ($record['status'] === 'Released') {
        sendError('Cannot edit a released payroll record.');
    }

    $daysWorked = (float)($body['days_worked'] ?? 0);
    $deductions = (float)($body['deductions']  ?? 0);

    if ($daysWorked <= 0)  sendError('Days worked must be greater than zero.');
    if ($deductions < 0)   sendError('Deductions cannot be negative.');

    // Recompute gross and net based on stored daily_rate
    $rateStmt = $db->prepare("SELECT daily_rate FROM payroll WHERE id = ?");
    $rateStmt->execute([$payrollId]);
    $dailyRate = (float)$rateStmt->fetch()['daily_rate'];

    $grossPay = round($daysWorked * $dailyRate, 2);
    $netPay   = round($grossPay - $deductions, 2);

    if ($netPay < 0) sendError('Deductions cannot exceed gross pay.');

    $stmt = $db->prepare("
        UPDATE payroll
        SET days_worked = ?,
            gross_pay   = ?,
            deductions  = ?,
            net_pay     = ?
        WHERE id = ? AND branch_id = ?
    ");
    $stmt->execute([
        $daysWorked, $grossPay, $deductions, $netPay,
        $payrollId, $user['branch_id'],
    ]);

    sendSuccess([
        'updated'    => true,
        'id'         => $payrollId,
        'gross_pay'  => $grossPay,
        'deductions' => $deductions,
        'net_pay'    => $netPay,
    ]);
}

// ── DELETE: Remove Draft payroll record ────────────────────
if ($method === 'DELETE') {
    $payrollId = (int)($_GET['id'] ?? 0);
    if (!$payrollId) sendError('Payroll ID is required.');

    $check = $db->prepare("
        SELECT id, status FROM payroll WHERE id = ? AND branch_id = ?
    ");
    $check->execute([$payrollId, $user['branch_id']]);
    $record = $check->fetch();

    if (!$record) sendError('Payroll record not found.', 404);
    if ($record['status'] === 'Released') {
        sendError('Cannot delete a released payroll record.');
    }

    $stmt = $db->prepare("DELETE FROM payroll WHERE id = ?");
    $stmt->execute([$payrollId]);

    sendSuccess(['deleted' => true, 'id' => $payrollId]);
}

sendError('Method not allowed.', 405);
<?php
// ============================================================
// FILE: api/employees/index.php
// PLACE IN: /api/employees/index.php
//
// ROUTES:
//   GET    ?branch_id=1   → list employees
//   GET    ?id=5          → single employee
//   POST                  → create employee
//   PUT    ?id=5          → update employee
//   DELETE ?id=5          → soft-delete (status = Inactive)
//
// ACCESS: admin only for all operations
//
// DB COLUMNS USED (must match employees_update.sql exactly):
//   id, branch_id, full_name, position, phone,
//   address, hire_date, daily_rate, status, created_at
// ============================================================

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';

setJsonHeaders();

// All employee operations are admin-only
$user   = requireAuth('admin');
$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ── GET: Single employee by ID ─────────────────────────────
if ($method === 'GET' && isset($_GET['id'])) {
    $employeeId = (int)$_GET['id'];

    $stmt = $db->prepare("
        SELECT id, branch_id, full_name, position, phone,
               address, hire_date, daily_rate, status, created_at
        FROM employees
        WHERE id = ?
    ");
    $stmt->execute([$employeeId]);
    $employee = $stmt->fetch();

    if (!$employee) sendError('Employee not found.', 404);
    sendSuccess($employee);
}

// ── GET: List all employees ────────────────────────────────
if ($method === 'GET') {
    // Admin can view other branch employees (read-only analytics)
    $branchId = isset($_GET['branch_id'])
        ? (int)$_GET['branch_id']
        : $user['branch_id'];

    requireBranchAccess($user, $branchId, 'read');

    // Optional status filter — default shows Active only
    $statusFilter = $_GET['status'] ?? 'Active';

    $params = [$branchId];
    $whereStatus = '';

    if ($statusFilter !== 'all') {
        $whereStatus = 'AND status = ?';
        $params[]    = $statusFilter;
    }

    $stmt = $db->prepare("
        SELECT id, branch_id, full_name, position, phone,
               address, hire_date, daily_rate, status, created_at
        FROM employees
        WHERE branch_id = ? $whereStatus
        ORDER BY full_name ASC
    ");
    $stmt->execute($params);
    $employees = $stmt->fetchAll();

    // Count active vs inactive for summary
    $countStmt = $db->prepare("
        SELECT status, COUNT(*) AS cnt
        FROM employees
        WHERE branch_id = ?
        GROUP BY status
    ");
    $countStmt->execute([$branchId]);
    $rawCounts = $countStmt->fetchAll();

    $counts = ['Active' => 0, 'Inactive' => 0];
    foreach ($rawCounts as $row) {
        if (array_key_exists($row['status'], $counts)) {
            $counts[$row['status']] = (int)$row['cnt'];
        }
    }

    sendSuccess([
        'employees' => $employees,
        'count'     => count($employees),
        'counts'    => $counts,
        'branch_id' => $branchId,
    ]);
}

// ── POST: Create new employee ──────────────────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    // Read and sanitize fields — names match HTML field IDs
    $fullName  = trim($body['full_name']  ?? '');
    $position  = trim($body['position']   ?? 'Staff');
    $phone     = trim($body['phone']      ?? '');
    $address   = trim($body['address']    ?? '');
    $hireDate  = trim($body['hire_date']  ?? '');
    $dailyRate = (float)($body['daily_rate'] ?? 0);

    // Validation
    if (empty($fullName))  sendError('Full name is required.');
    if (empty($position))  sendError('Position is required.');
    if (empty($hireDate))  sendError('Hire date is required.');
    if ($dailyRate <= 0)   sendError('Daily rate must be greater than zero.');

    // Validate hire_date format (must be YYYY-MM-DD)
    $parsedDate = date_create($hireDate);
    if (!$parsedDate) sendError('Invalid hire date format.');

    $stmt = $db->prepare("
        INSERT INTO employees
            (branch_id, full_name, position, phone, address, hire_date, daily_rate, status)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, 'Active')
    ");
    $stmt->execute([
        $user['branch_id'],
        $fullName,
        $position,
        $phone,
        $address,
        $hireDate,
        $dailyRate,
    ]);

    sendSuccess(['id' => (int)$db->lastInsertId()], 201);
}

// ── PUT: Update existing employee ─────────────────────────
if ($method === 'PUT') {
    $employeeId = (int)($_GET['id'] ?? 0);
    if (!$employeeId) sendError('Employee ID is required.');

    // Confirm employee belongs to this admin's branch
    $check = $db->prepare("
        SELECT id FROM employees WHERE id = ? AND branch_id = ?
    ");
    $check->execute([$employeeId, $user['branch_id']]);
    if (!$check->fetch()) sendError('Employee not found or not in your branch.', 404);

    $body = json_decode(file_get_contents('php://input'), true);

    $fullName  = trim($body['full_name']  ?? '');
    $position  = trim($body['position']   ?? 'Staff');
    $phone     = trim($body['phone']      ?? '');
    $address   = trim($body['address']    ?? '');
    $hireDate  = trim($body['hire_date']  ?? '');
    $dailyRate = (float)($body['daily_rate'] ?? 0);
    $status    = in_array($body['status'] ?? '', ['Active', 'Inactive'])
                    ? $body['status'] : 'Active';

    if (empty($fullName))  sendError('Full name is required.');
    if (empty($position))  sendError('Position is required.');
    if (empty($hireDate))  sendError('Hire date is required.');
    if ($dailyRate <= 0)   sendError('Daily rate must be greater than zero.');

    $parsedDate = date_create($hireDate);
    if (!$parsedDate) sendError('Invalid hire date format.');

    $stmt = $db->prepare("
        UPDATE employees
        SET full_name  = ?,
            position   = ?,
            phone      = ?,
            address    = ?,
            hire_date  = ?,
            daily_rate = ?,
            status     = ?
        WHERE id = ? AND branch_id = ?
    ");
    $stmt->execute([
        $fullName,
        $position,
        $phone,
        $address,
        $hireDate,
        $dailyRate,
        $status,
        $employeeId,
        $user['branch_id'],
    ]);

    sendSuccess(['updated' => true, 'id' => $employeeId]);
}

// ── DELETE: Soft-delete (set status = Inactive) ────────────
// Soft-delete keeps payroll history intact.
// Hard deletes would break payroll records referencing this employee.
if ($method === 'DELETE') {
    $employeeId = (int)($_GET['id'] ?? 0);
    if (!$employeeId) sendError('Employee ID is required.');

    $check = $db->prepare("
        SELECT id FROM employees WHERE id = ? AND branch_id = ?
    ");
    $check->execute([$employeeId, $user['branch_id']]);
    if (!$check->fetch()) sendError('Employee not found or not in your branch.', 404);

    $stmt = $db->prepare("
        UPDATE employees SET status = 'Inactive' WHERE id = ?
    ");
    $stmt->execute([$employeeId]);

    sendSuccess(['deactivated' => true, 'id' => $employeeId]);
}

sendError('Method not allowed.', 405);
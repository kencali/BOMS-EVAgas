<?php
// ============================================================
// FILE: api/helpers/auth_check.php
// PURPOSE: The "security guard" for every protected API file.
//
// HOW TO USE: Put this at the top of any API file that needs login:
//   $user = requireAuth();              ← any logged-in user
//   $user = requireAuth('admin');       ← admin only
//   $user = requireAuth('employee');    ← employee only
//   $user = requireAuth('deliverer');   ← deliverer only
//   $user = requireAuth(['admin','employee']); ← multiple roles
//
// If the token is missing/invalid/wrong role → sends 401 and stops.
// If valid → returns the user data from the token.
// ============================================================

require_once __DIR__ . '/../helpers/jwt.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../config/database.php';

function requireAuth(string|array $roles = []): array {
    $token = getTokenFromHeader();

    if (!$token) {
        sendError('No token provided. Please login.', 401);
    }

    $user = verifyToken($token);

    if (!$user) {
        sendError('Invalid or expired token. Please login again.', 401);
    }

    // JWTs are signed, but their claims can become stale after an account is disabled,
    // reassigned to a branch, or has its role changed. Re-check the current server record.
    $db = getDB();
    $accountStmt = $db->prepare(
        "SELECT id, role, branch_id, status, token_version
         FROM users WHERE id = ? LIMIT 1"
    );
    $accountStmt->execute([(int)$user['user_id']]);
    $account = $accountStmt->fetch();
    if (!$account || $account['status'] !== 'Active'
        || $account['role'] !== $user['role']
        || (int)$account['branch_id'] !== (int)$user['branch_id']
        || (int)$account['token_version'] !== (int)($user['token_version'] ?? -1)) {
        sendError('Account is no longer authorized. Please login again.', 401);
    }

    // If roles are specified, check if user has the right role
    if (!empty($roles)) {
        $allowed = is_array($roles) ? $roles : [$roles];
        if (!in_array($user['role'], $allowed)) {
            sendError('Access denied. You do not have permission for this action.', 403);
        }
    }

    return $user; // returns ['user_id' => 1, 'role' => 'admin', 'branch_id' => 1]
}

// ============================================================
// BRANCH ACCESS HELPER
//
// Rule: Each branch can fully manage their own data.
//       They can VIEW (read-only) the other branch's reports.
//
// Usage:
//   requireBranchAccess($user, $requestedBranchId, 'write');
//   requireBranchAccess($user, $requestedBranchId, 'read');
// ============================================================

function requireBranchAccess(array $user, int $requestedBranch, string $mode = 'read'): void {
    if ($requestedBranch <= 0) {
        sendError('Invalid branch.', 400);
    }
    $isOwnBranch = ($user['branch_id'] === $requestedBranch);

    if ($mode === 'write' && !$isOwnBranch) {
        sendError('You can only modify data for your own branch.', 403);
    }

    // Cross-branch read-only analytics are an explicitly admin-only exception.
    if ($mode === 'read' && !$isOwnBranch && $user['role'] !== 'admin') {
        sendError('You can only view data from your own branch.', 403);
    }
}

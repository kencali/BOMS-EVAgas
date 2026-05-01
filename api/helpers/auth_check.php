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

function requireAuth(string|array $roles = []): array {
    $token = getTokenFromHeader();

    if (!$token) {
        sendError('No token provided. Please login.', 401);
    }

    $user = verifyToken($token);

    if (!$user) {
        sendError('Invalid or expired token. Please login again.', 401);
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
    $isOwnBranch = ($user['branch_id'] === $requestedBranch);

    if ($mode === 'write' && !$isOwnBranch) {
        sendError('You can only modify data for your own branch.', 403);
    }

    // 'read' mode: both own and other branch are allowed
    // (the calling file decides what data to return)
}
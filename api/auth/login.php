<?php

// FILE: api/auth/login.php
// METHOD: POST
// PURPOSE: Accepts username + password, returns a JWT token.


require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/jwt.php';
require_once __DIR__ . '/../helpers/login_rate_limit.php';

setJsonHeaders(); // always first

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed.', 405);
}

// Read JSON body from the request
// (The frontend sends JSON, not a form — that's the key difference)
$body = json_decode(file_get_contents('php://input'), true);

$username = trim($body['username'] ?? '');
$password = trim($body['password'] ?? '');

// Basic validation
if ($username === '' || $password === '' || strlen($username) > 60) {
    sendError('Invalid username or password.', 401);
}

// Query the database
// YOUR EXISTING users TABLE should have: id, username, password, role, branch_id, full_name
// role must be one of: 'admin' | 'employee' | 'deliverer'
$db  = getDB();
rejectIfLoginThrottled($db, $username);

$sql = "SELECT id, username, password, role, branch_id, full_name, status, token_version
        FROM users 
        WHERE username = ? 
        LIMIT 1";

$stmt = $db->prepare($sql);
$stmt->execute([$username]);
$user = $stmt->fetch();

// Use one response for missing, disabled, and incorrect-password accounts.
if (!$user || $user['status'] !== 'Active' || !password_verify($password, $user['password'])) {
    recordFailedLogin($db, $username);
    sendError('Invalid username or password.', 401);
}

clearFailedLogins($db, $username);

// Determine where to redirect after login based on role
$redirectMap = [
    'admin'     => '/BOMS-EVAgas/public/admin/dashboard.html',
    'employee'  => '/BOMS-EVAgas/public/employee/dashboard.html',
    'deliverer' => '/BOMS-EVAgas/public/deliverer/dashboard.html',
];

$redirect = $redirectMap[$user['role']] ?? '/BOMS-EVAgas/public/index.html';

// Generate JWT token (replaces PHP session)
$token = generateToken($user['id'], $user['role'], (int)$user['branch_id'], (int)$user['token_version']);

// Send back everything the frontend needs
sendSuccess([
    'token'     => $token,
    'role'      => $user['role'],
    'branch_id' => (int)$user['branch_id'],
    'full_name' => $user['full_name'],
    'redirect'  => $redirect,
]);

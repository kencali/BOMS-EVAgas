<?php

// FILE: api/auth/login.php
// METHOD: POST
// PURPOSE: Accepts username + password, returns a JWT token.


require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/jwt.php';

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
if (empty($username) || empty($password)) {
    sendError('Username and password are required.');
}

// Query the database
// YOUR EXISTING users TABLE should have: id, username, password, role, branch_id, full_name
// role must be one of: 'admin' | 'employee' | 'deliverer'
$db  = getDB();
$sql = "SELECT id, username, password, role, branch_id, full_name 
        FROM users 
        WHERE username = ? 
        LIMIT 1";

$stmt = $db->prepare($sql);
$stmt->execute([$username]);
$user = $stmt->fetch();

// Check if user exists
if (!$user) {
    sendError('User not found.', 401); // 401 = not authorized
}

// Check password
// password_verify() works with your existing password_hash() passwords
if (!password_verify($password, $user['password'])) {
    sendError('User not found.', 401);
}

// Determine where to redirect after login based on role
$redirectMap = [
    'admin'     => '/BOMS-EVAgas/public/admin/dashboard.html',
    'employee'  => '/BOMS-EVAgas/public/employee/dashboard.html',
    'deliverer' => '/BOMS-EVAgas/public/deliverer/dashboard.html',
];

$redirect = $redirectMap[$user['role']] ?? '/BOMS-EVAgas/public/index.html';

// Generate JWT token (replaces PHP session)
$token = generateToken($user['id'], $user['role'], (int)$user['branch_id']);

// Send back everything the frontend needs
sendSuccess([
    'token'     => $token,
    'role'      => $user['role'],
    'branch_id' => (int)$user['branch_id'],
    'full_name' => $user['full_name'],
    'redirect'  => $redirect,
]);
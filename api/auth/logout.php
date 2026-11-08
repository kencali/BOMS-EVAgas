<?php
require_once __DIR__ . '/../helpers/response.php';
require_once __DIR__ . '/../helpers/auth_check.php';
require_once __DIR__ . '/../config/database.php';
setJsonHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed.', 405);
}

$user = requireAuth();
$stmt = getDB()->prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?');
$stmt->execute([(int)$user['user_id']]);
sendSuccess(['message' => 'Logged out successfully.']);

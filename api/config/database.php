<?php
// ============================================================
// FILE: api/config/database.php
// PURPOSE: One place to manage your DB connection.
//          Uses PDO (cleaner than mysqli, same idea).
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'boms_evagas');
define('DB_USER', 'root');       // ← change to your DB username
define('DB_PASS', '');           // ← change to your DB password

function getDB(): PDO {
    static $pdo = null; // keeps one connection alive, doesn't reconnect every time

    if ($pdo === null) {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,  // throw errors
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,        // return arrays
                PDO::ATTR_EMULATE_PREPARES   => false,                   // real prepared statements
            ]);
        } catch (PDOException $e) {
            // Never expose the real error to the browser in production
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Database connection failed.']);
            exit();
        }
    }

    return $pdo;
}
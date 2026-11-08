<?php
// ============================================================
// FILE: api/config/database.php
// PURPOSE: One place to manage your DB connection.
//          Uses PDO (cleaner than mysqli, same idea).
// ============================================================

require_once __DIR__ . '/env.php';

function getDB(): PDO {
    static $pdo = null; // keeps one connection alive, doesn't reconnect every time

    if ($pdo === null) {
        try {
            $environment = bomsEnvValue('BOMS_APP_ENV') ?? 'production';
            $host = bomsRequireEnv('BOMS_DB_HOST');
            $port = bomsRequireEnv('BOMS_DB_PORT');
            $name = bomsRequireEnv('BOMS_DB_NAME');
            $user = bomsRequireEnv('BOMS_DB_USER');
            $pass = bomsRequireEnv('BOMS_DB_PASS', $environment === 'local');

            if (!ctype_digit($port)) {
                bomsConfigFailure('BOMS_DB_PORT must be numeric');
            }
            if ($environment !== 'local' && $pass === '') {
                bomsConfigFailure('BOMS_DB_PASS cannot be empty outside local development');
            }

            $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,  // throw errors
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,        // return arrays
                PDO::ATTR_EMULATE_PREPARES   => false,                   // real prepared statements
            ]);
        } catch (PDOException $e) {
            // Details remain in the server log; clients receive no credentials or driver errors.
            error_log('BOMS database connection failed.');
            bomsConfigFailure('database connection failed');
        }
    }

    return $pdo;
}

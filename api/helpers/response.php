<?php
// ============================================================
// FILE: api/helpers/response.php
// PURPOSE: Every API response looks the same.
//          The frontend always knows what to expect.
//
// SUCCESS: { "success": true,  "data": { ... } }
// ERROR:   { "success": false, "message": "..." }
// ============================================================

require_once __DIR__ . '/../config/env.php';

function sendSuccess(array $data = [], int $code = 200): void {
    http_response_code($code);
    echo json_encode(['success' => true, 'data' => $data]);
    exit();
}

function sendError(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

// Call this at the top of every API file
function setJsonHeaders(): void {
    bomsConfigureRuntime();
    header('Content-Type: application/json');
    // API responses contain authenticated business data and must never be retained by caches.
    header('Cache-Control: no-store, private, max-age=0');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        $configuredOrigins = bomsEnvValue('BOMS_CORS_ALLOWED_ORIGINS') ?? '';
        // Local XAMPP has predictable development origins; production must opt in explicitly.
        if ($configuredOrigins === '' && bomsIsLocalEnvironment()) {
            $configuredOrigins = 'http://localhost,http://127.0.0.1';
        }
        $allowedOrigins = array_filter(array_map('trim', explode(',', $configuredOrigins)));

        if (in_array($origin, $allowedOrigins, true)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Vary: Origin');
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, Authorization');
            header('Access-Control-Max-Age: 600');
        }
    }

    // Browsers may send OPTIONS preflight requests. An untrusted origin receives no CORS grant.
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit();
    }
}

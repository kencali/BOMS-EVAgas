<?php
// ============================================================
// FILE: api/helpers/response.php
// PURPOSE: Every API response looks the same.
//          The frontend always knows what to expect.
//
// SUCCESS: { "success": true,  "data": { ... } }
// ERROR:   { "success": false, "message": "..." }
// ============================================================

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
    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');                   // allow browser requests
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    // Browsers send OPTIONS first (preflight check) — just say OK and stop
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}
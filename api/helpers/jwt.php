<?php
// ============================================================
// FILE: api/helpers/jwt.php
// PURPOSE: Handles login tokens (JWT = JSON Web Token).
//
// WHAT IS A TOKEN?
//   After login, we give the user a "token" — a long string.
//   They send it back with every request so we know who they are.
//   No session needed. Works from any device (mobile, web, app).
//
// FORMAT: header.payload.signature  (3 parts joined by a dot)
// ============================================================

define('JWT_SECRET', 'boms_evagas_secret_2025_change_this'); // ← change this to something random
define('JWT_EXPIRY', 60 * 60 * 8); // token lasts 8 hours (in seconds)

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

// Creates a token for a logged-in user
function generateToken(int $userId, string $role, int $branchId): string {
    $header = base64UrlEncode(json_encode([
        'alg' => 'HS256',
        'typ' => 'JWT'
    ]));

    $payload = base64UrlEncode(json_encode([
        'user_id'   => $userId,
        'role'      => $role,       // 'admin' | 'employee' | 'deliverer'
        'branch_id' => $branchId,
        'exp'       => time() + JWT_EXPIRY
    ]));

    $signature = base64UrlEncode(
        hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
    );

    return "$header.$payload.$signature";
}

// Reads a token and returns the user data inside it
// Returns null if invalid or expired
function verifyToken(string $token): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    [$header, $payload, $signature] = $parts;

    // Re-create the signature and compare — detects tampering
    $expectedSig = base64UrlEncode(
        hash_hmac('sha256', "$header.$payload", JWT_SECRET, true)
    );

    if (!hash_equals($expectedSig, $signature)) return null; // tampered

    $data = json_decode(base64UrlDecode($payload), true);
    if (!$data) return null;

    if ($data['exp'] < time()) return null; // expired

    return $data;
}

// Gets the token from the request header
// The frontend sends: Authorization: Bearer <token>
function getTokenFromHeader(): ?string {
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($auth, 'Bearer ')) {
        return substr($auth, 7);
    }
    return null;
}
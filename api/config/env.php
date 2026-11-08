<?php
// Server-side environment configuration loader.
// The optional .env file lives at the project root, outside /public, and is ignored by Git.

function bomsLoadEnvironment(): void {
    static $loaded = false;
    if ($loaded) return;
    $loaded = true;

    $path = dirname(__DIR__, 2) . '/.env';
    if (!is_file($path) || !is_readable($path)) return;

    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;

        $separator = strpos($line, '=');
        if ($separator === false) continue;

        $name = trim(substr($line, 0, $separator));
        $value = trim(substr($line, $separator + 1));
        if (!preg_match('/^[A-Z][A-Z0-9_]*$/', $name)) continue;

        if (strlen($value) >= 2 && (($value[0] === '"' && substr($value, -1) === '"') || ($value[0] === "'" && substr($value, -1) === "'"))) {
            $value = substr($value, 1, -1);
        }

        // Real server environment variables take precedence over the local file.
        if (getenv($name) === false) {
            putenv("{$name}={$value}");
            $_ENV[$name] = $value;
        }
    }
}

function bomsEnvValue(string $name): ?string {
    bomsLoadEnvironment();
    $value = getenv($name);
    if ($value !== false) return $value;
    return array_key_exists($name, $_ENV) ? (string)$_ENV[$name] : null;
}

function bomsIsLocalEnvironment(): bool {
    return (bomsEnvValue('BOMS_APP_ENV') ?? 'production') === 'local';
}

function bomsConfigureRuntime(): void {
    static $configured = false;
    if ($configured) return;
    $configured = true;

    // Development remains convenient, while production never sends PHP internals to clients.
    ini_set('display_errors', bomsIsLocalEnvironment() ? '1' : '0');
    ini_set('display_startup_errors', bomsIsLocalEnvironment() ? '1' : '0');
    ini_set('log_errors', '1');
}

function bomsConfigFailure(string $detail): never {
    error_log("BOMS configuration error: {$detail}");
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Server configuration error.']);
    exit;
}

function bomsRequireEnv(string $name, bool $allowEmpty = false): string {
    $value = bomsEnvValue($name);
    if ($value === null || (!$allowEmpty && trim($value) === '')) {
        bomsConfigFailure("missing required environment variable {$name}");
    }
    return $value;
}

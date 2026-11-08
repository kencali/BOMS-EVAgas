<?php
declare(strict_types=1);

// CLI-only, forward-only SQL migration runner. It never discovers or runs the
// legacy SQL files outside database/migrations/.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("This command is CLI-only.\n");
}

require_once __DIR__ . '/../api/config/database.php';

function migrationFail(string $message): never {
    fwrite(STDERR, "Migration failed: {$message}\n");
    exit(1);
}

function migrationFiles(string $directory): array {
    $files = glob($directory . '/*.sql') ?: [];
    sort($files, SORT_STRING);
    foreach ($files as $file) {
        if (!preg_match('/^\d{14}_[a-z0-9_]+\.sql$/i', basename($file))) {
            migrationFail('Invalid migration filename: ' . basename($file));
        }
    }
    return $files;
}

$command = $argv[1] ?? '--status';
if (!in_array($command, ['--status', '--apply'], true)) {
    migrationFail('Use --status or --apply.');
}

$db = getDB();
$directory = realpath(__DIR__ . '/../database/migrations');
if ($directory === false) migrationFail('database/migrations directory is missing.');
$files = migrationFiles($directory);

if ($command === '--status') {
    $exists = (bool)$db->query("SHOW TABLES LIKE 'schema_migrations'")->fetchColumn();
    $applied = [];
    if ($exists) {
        foreach ($db->query('SELECT version, checksum, applied_at FROM schema_migrations ORDER BY version') as $row) {
            $applied[$row['version']] = $row;
        }
    }

    echo "Migration status:\n";
    if (!$files) echo "  No managed migration files found.\n";
    foreach ($files as $file) {
        $version = basename($file, '.sql');
        $checksum = hash_file('sha256', $file);
        if (!isset($applied[$version])) {
            echo "  PENDING  {$version}\n";
        } elseif (!hash_equals($applied[$version]['checksum'], $checksum)) {
            echo "  CHANGED  {$version} (do not edit an applied migration)\n";
        } else {
            echo "  APPLIED  {$version} at {$applied[$version]['applied_at']}\n";
        }
    }
    exit(0);
}

$db->exec("CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(191) NOT NULL PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

if (!(int)$db->query("SELECT GET_LOCK('boms_schema_migrations', 10)")->fetchColumn()) {
    migrationFail('Another migration process is running.');
}

try {
    $applied = [];
    foreach ($db->query('SELECT version, checksum FROM schema_migrations') as $row) {
        $applied[$row['version']] = $row['checksum'];
    }

    foreach ($files as $file) {
        $version = basename($file, '.sql');
        $checksum = hash_file('sha256', $file);
        if (isset($applied[$version])) {
            if (!hash_equals($applied[$version], $checksum)) {
                migrationFail("{$version} was changed after it was applied.");
            }
            echo "Already applied: {$version}\n";
            continue;
        }

        $sql = trim((string)file_get_contents($file));
        if ($sql === '') migrationFail("{$version} is empty.");
        try {
            // MySQL DDL may commit implicitly. Keep every migration small and
            // review it plus a backup before applying in production.
            $db->exec($sql);
            $record = $db->prepare('INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)');
            $record->execute([$version, $checksum]);
            echo "Applied: {$version}\n";
        } catch (Throwable $error) {
            error_log("BOMS migration {$version} failed.");
            migrationFail("{$version}. No later migrations were run; inspect the database before retrying.");
        }
    }
} finally {
    $db->query("SELECT RELEASE_LOCK('boms_schema_migrations')");
}

echo "Migration run complete.\n";

<?php
declare(strict_types=1);

// Creates a timestamped logical MySQL/MariaDB backup. This script never
// restores a database and only deletes old backups with explicit --prune.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("This command is CLI-only.\n");
}

require_once __DIR__ . '/../api/config/env.php';

function backupFail(string $message): never {
    fwrite(STDERR, "Backup failed: {$message}\n");
    exit(1);
}
function backupValue(string $name): string {
    $value = bomsEnvValue($name);
    if ($value === null || trim($value) === '') backupFail("missing {$name}");
    return $value;
}
function iniValue(string $value): string {
    if (str_contains($value, "\n") || str_contains($value, "\r")) backupFail('configuration contains an invalid line break');
    return '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $value) . '"';
}
function backupLog(string $directory, string $message): void {
    file_put_contents($directory . DIRECTORY_SEPARATOR . 'backup.log', '[' . date('c') . "] {$message}\n", FILE_APPEND | LOCK_EX);
}

$prune = in_array('--prune', $argv, true);
$backupDirectory = backupValue('BOMS_BACKUP_DIR');
$dumpPath = backupValue('BOMS_MYSQLDUMP_PATH');
$retentionDays = (int)(bomsEnvValue('BOMS_BACKUP_RETENTION_DAYS') ?? '30');
if ($retentionDays < 1 || $retentionDays > 3650) backupFail('BOMS_BACKUP_RETENTION_DAYS must be between 1 and 3650');
if (!is_file($dumpPath)) backupFail('BOMS_MYSQLDUMP_PATH does not point to mysqldump');

if (!is_dir($backupDirectory) && !mkdir($backupDirectory, 0700, true) && !is_dir($backupDirectory)) {
    backupFail('backup directory could not be created');
}
$backupDirectory = realpath($backupDirectory);
$publicDirectory = realpath(__DIR__ . '/../public');
if ($backupDirectory === false || ($publicDirectory !== false && str_starts_with(strtolower($backupDirectory), strtolower($publicDirectory)))) {
    backupFail('backup directory must be outside the public document root');
}

$host = backupValue('BOMS_DB_HOST');
$port = backupValue('BOMS_DB_PORT');
$database = backupValue('BOMS_DB_NAME');
$user = backupValue('BOMS_DB_USER');
$password = bomsEnvValue('BOMS_DB_PASS') ?? '';
$stamp = date('Ymd_His');
$target = $backupDirectory . DIRECTORY_SEPARATOR . "boms_{$stamp}.sql";
$partial = $target . '.part';
$defaults = tempnam(sys_get_temp_dir(), 'boms-db-');
if ($defaults === false) backupFail('temporary credential file could not be created');

try {
    $contents = "[client]\nhost=" . iniValue($host) . "\nport=" . iniValue($port) . "\nuser=" . iniValue($user) . "\npassword=" . iniValue($password) . "\n";
    if (file_put_contents($defaults, $contents, LOCK_EX) === false) backupFail('temporary credential file could not be written');

    $command = escapeshellarg($dumpPath)
        . ' --defaults-extra-file=' . escapeshellarg($defaults)
        . ' --single-transaction --routines --events --triggers --default-character-set=utf8mb4'
        . ' --databases ' . escapeshellarg($database)
        . ' --result-file=' . escapeshellarg($partial);
    $process = proc_open($command, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (!is_resource($process)) backupFail('mysqldump could not be started');
    $output = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    $exitCode = proc_close($process);
    if ($exitCode !== 0 || !is_file($partial) || filesize($partial) === 0) {
        @unlink($partial);
        error_log('BOMS database backup failed.');
        backupFail('mysqldump did not complete successfully. Check the server log.');
    }
    if (!rename($partial, $target)) backupFail('completed backup could not be finalized');
    backupLog($backupDirectory, 'SUCCESS ' . basename($target));
    echo 'Backup created: ' . basename($target) . PHP_EOL;

    if ($prune) {
        $cutoff = time() - ($retentionDays * 86400);
        foreach (glob($backupDirectory . DIRECTORY_SEPARATOR . 'boms_*.sql') ?: [] as $file) {
            if (filemtime($file) < $cutoff && unlink($file)) {
                backupLog($backupDirectory, 'PRUNED ' . basename($file));
                echo 'Pruned expired backup: ' . basename($file) . PHP_EOL;
            }
        }
    }
} finally {
    @unlink($defaults);
}

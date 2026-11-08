<?php
// Small database-backed throttle. It is intentionally keyed by both IP and username
// so a shared office connection is not locked by attempts against another account.

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_LOCK_SECONDS = 15 * 60;

function loginAttemptKey(string $username): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return hash('sha256', strtolower($username) . '|' . $ip);
}

function rejectIfLoginThrottled(PDO $db, string $username): void {
    $stmt = $db->prepare('SELECT locked_until FROM login_throttle WHERE attempt_key = ? LIMIT 1');
    $stmt->execute([loginAttemptKey($username)]);
    $record = $stmt->fetch();

    if ($record && $record['locked_until'] !== null && strtotime($record['locked_until']) > time()) {
        error_log('BOMS login throttled for a username/IP combination.');
        sendError('Too many login attempts. Please try again later.', 429);
    }
}

function recordFailedLogin(PDO $db, string $username): void {
    $key = loginAttemptKey($username);
    $stmt = $db->prepare('SELECT attempt_count, first_attempt_at FROM login_throttle WHERE attempt_key = ? FOR UPDATE');
    $db->beginTransaction();
    try {
        $stmt->execute([$key]);
        $record = $stmt->fetch();
        $now = date('Y-m-d H:i:s');

        if (!$record || strtotime($record['first_attempt_at']) <= time() - LOGIN_WINDOW_SECONDS) {
            $count = 1;
            $first = $now;
        } else {
            $count = (int)$record['attempt_count'] + 1;
            $first = $record['first_attempt_at'];
        }

        $lockedUntil = $count >= LOGIN_MAX_ATTEMPTS
            ? date('Y-m-d H:i:s', time() + LOGIN_LOCK_SECONDS)
            : null;

        $upsert = $db->prepare(
            'INSERT INTO login_throttle (attempt_key, attempt_count, first_attempt_at, locked_until, updated_at)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE attempt_count = VALUES(attempt_count), first_attempt_at = VALUES(first_attempt_at),
                 locked_until = VALUES(locked_until), updated_at = NOW()'
        );
        $upsert->execute([$key, $count, $first, $lockedUntil]);
        $db->commit();

        if ($lockedUntil !== null) {
            error_log('BOMS login rate limit reached for a username/IP combination.');
        }
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        error_log('BOMS login throttle could not be recorded.');
        // Authentication remains available if the optional throttle storage is unavailable.
    }
}

function clearFailedLogins(PDO $db, string $username): void {
    $stmt = $db->prepare('DELETE FROM login_throttle WHERE attempt_key = ?');
    $stmt->execute([loginAttemptKey($username)]);
}

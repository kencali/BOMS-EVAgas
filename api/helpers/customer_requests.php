<?php
// Helpers for the customer portal. The schema check lets existing BOMS roles
// keep working until the reviewed CUST-001 migration is explicitly applied.

function customerRequestSchemaReady(PDO $db): bool {
    static $ready = null;
    if ($ready !== null) return $ready;
    $column = $db->query("SHOW COLUMNS FROM deliveries LIKE 'customer_reference'")->fetch();
    $table = $db->query("SHOW TABLES LIKE 'customer_request_throttle'")->fetch();
    return $ready = (bool)$column && (bool)$table;
}

function customerRequestThrottleKey(): string {
    return hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
}

function customerRequestRateLimit(PDO $db): void {
    $key = customerRequestThrottleKey();
    $db->beginTransaction();
    try {
        $select = $db->prepare('SELECT attempt_count, window_started_at FROM customer_request_throttle WHERE attempt_key = ? FOR UPDATE');
        $select->execute([$key]);
        $record = $select->fetch();
        $now = date('Y-m-d H:i:s');
        $newWindow = !$record || strtotime($record['window_started_at']) <= time() - 3600;
        $count = $newWindow ? 1 : (int)$record['attempt_count'] + 1;
        if ($count > 5) {
            $db->rollBack();
            throw new RuntimeException('Too many delivery requests from this connection. Please try again later.');
        }
        $upsert = $db->prepare('INSERT INTO customer_request_throttle (attempt_key, attempt_count, window_started_at, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE attempt_count = VALUES(attempt_count), window_started_at = VALUES(window_started_at), updated_at = NOW()');
        $upsert->execute([$key, $count, $newWindow ? $now : $record['window_started_at']]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

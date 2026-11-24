<?php
// Helpers for the customer portal. The schema check lets existing BOMS roles
// keep working until the reviewed CUST-001 migration is explicitly applied.

final class CustomerRateLimitException extends RuntimeException {}

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

function customerPublicRateLimit(PDO $db, string $scope, int $maxAttempts, int $windowSeconds): void {
    // One table supports separate, server-side public endpoint limits without
    // storing raw IP addresses. Scope prevents location searches and status
    // checks from consuming the delivery-submission quota.
    $key = hash('sha256', $scope . '|' . customerRequestThrottleKey());
    $db->beginTransaction();
    try {
        $select = $db->prepare('SELECT attempt_count, window_started_at FROM customer_request_throttle WHERE attempt_key = ? FOR UPDATE');
        $select->execute([$key]);
        $record = $select->fetch();
        $now = date('Y-m-d H:i:s');
        $newWindow = !$record || strtotime($record['window_started_at']) <= time() - $windowSeconds;
        $count = $newWindow ? 1 : (int)$record['attempt_count'] + 1;
        if ($count > $maxAttempts) {
            $db->rollBack();
            throw new CustomerRateLimitException('Too many requests from this connection. Please try again later.');
        }
        $upsert = $db->prepare('INSERT INTO customer_request_throttle (attempt_key, attempt_count, window_started_at, updated_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE attempt_count = VALUES(attempt_count), window_started_at = VALUES(window_started_at), updated_at = NOW()');
        $upsert->execute([$key, $count, $newWindow ? $now : $record['window_started_at']]);
        $db->commit();
    } catch (Throwable $error) {
        if ($db->inTransaction()) $db->rollBack();
        throw $error;
    }
}

function customerRequestRateLimit(PDO $db): void {
    customerPublicRateLimit($db, 'delivery-request', 5, 3600);
}

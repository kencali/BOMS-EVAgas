-- SEC-002: apply once during a maintenance window, after taking a database backup.
-- Adds server-validated account state and a compact login rate-limit store.

ALTER TABLE users
    ADD COLUMN status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active' AFTER full_name,
    ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER status;

CREATE TABLE login_throttle (
    attempt_key CHAR(64) NOT NULL,
    attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    first_attempt_at DATETIME NOT NULL,
    locked_until DATETIME NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (attempt_key),
    KEY idx_login_throttle_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

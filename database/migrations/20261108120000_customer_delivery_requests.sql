-- CUST-001: customer requests reuse deliveries and require Admin review.
-- Apply only after a verified backup. Existing internal deliveries stay Approved.
ALTER TABLE deliveries
    ADD COLUMN customer_reference VARCHAR(40) NULL AFTER customer_phone,
    ADD COLUMN request_source ENUM('Internal','Customer') NOT NULL DEFAULT 'Internal' AFTER customer_reference,
    ADD COLUMN request_status ENUM('Approved','Pending Review','Rejected') NOT NULL DEFAULT 'Approved' AFTER request_source,
    ADD COLUMN submitted_latitude DECIMAL(10,7) NULL AFTER longitude,
    ADD COLUMN submitted_longitude DECIMAL(10,7) NULL AFTER submitted_latitude,
    ADD COLUMN customer_request_token CHAR(36) NULL AFTER request_status,
    ADD UNIQUE KEY uq_delivery_customer_reference (customer_reference),
    ADD UNIQUE KEY uq_delivery_customer_request_token (customer_request_token),
    ADD KEY idx_delivery_customer_review (branch_id, request_status, delivery_status);

CREATE TABLE customer_request_throttle (
    attempt_key CHAR(64) NOT NULL,
    attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    window_started_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (attempt_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

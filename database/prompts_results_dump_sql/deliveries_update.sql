-- ============================================================
-- FILE: database/deliveries_update.sql
-- COLUMN NAMES (used verbatim in api/deliveries/index.php):
--   id, branch_id, customer_name, customer_phone,
--   customer_address, product_id, quantity,
--   delivery_status, assigned_to, notes,
--   created_by, created_at, delivered_at
-- STATUS VALUES: 'Pending' | 'On the way' | 'Delivered' | 'Cancelled'
-- ============================================================

CREATE TABLE IF NOT EXISTS `deliveries` (
  `id`               INT          NOT NULL AUTO_INCREMENT,
  `branch_id`        TINYINT      NOT NULL DEFAULT 1,
  `customer_name`    VARCHAR(100) NOT NULL,
  `customer_phone`   VARCHAR(20)  NOT NULL DEFAULT '',
  `customer_address` TEXT         NOT NULL,
  `product_id`       INT          NOT NULL,
  `quantity`         INT          NOT NULL DEFAULT 1,
  `delivery_status`  ENUM('Pending','On the way','Delivered','Cancelled')
                                  NOT NULL DEFAULT 'Pending',
  `assigned_to`      INT          NULL,      -- FK → users.id (deliverer)
  `notes`            TEXT         NULL,
  `created_by`       INT          NULL,      -- FK → users.id (who logged it)
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `delivered_at`     DATETIME     NULL,      -- set when status → Delivered
  PRIMARY KEY (`id`),
  INDEX `idx_branch_status`  (`branch_id`, `delivery_status`),
  INDEX `idx_assigned`       (`assigned_to`),
  FOREIGN KEY (`product_id`)  REFERENCES `products`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`)    ON DELETE SET NULL,
  FOREIGN KEY (`created_by`)  REFERENCES `users`(`id`)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── If deliveries table already exists, add missing columns ─
-- ALTER TABLE `deliveries` ADD COLUMN `branch_id`        TINYINT      NOT NULL DEFAULT 1    AFTER `id`;
-- ALTER TABLE `deliveries` ADD COLUMN `customer_phone`   VARCHAR(20)  NOT NULL DEFAULT ''   AFTER `customer_name`;
-- ALTER TABLE `deliveries` ADD COLUMN `customer_address` TEXT         NOT NULL               AFTER `customer_phone`;
-- ALTER TABLE `deliveries` ADD COLUMN `assigned_to`      INT          NULL                   AFTER `delivery_status`;
-- ALTER TABLE `deliveries` ADD COLUMN `notes`            TEXT         NULL                   AFTER `assigned_to`;
-- ALTER TABLE `deliveries` ADD COLUMN `created_by`       INT          NULL                   AFTER `notes`;
-- ALTER TABLE `deliveries` ADD COLUMN `delivered_at`     DATETIME     NULL                   AFTER `created_at`;
-- ALTER TABLE `deliveries` MODIFY COLUMN `delivery_status`
--   ENUM('Pending','On the way','Delivered','Cancelled') NOT NULL DEFAULT 'Pending';
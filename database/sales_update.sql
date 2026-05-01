-- ============================================================
-- FILE: database/sales_update.sql
-- PURPOSE: Creates sales + sale_items tables.
--          sale_items = one row per product per transaction.
--          This is the "line items" pattern — cleaner than
--          storing everything in one column.
-- ============================================================

-- ── Sales header (one row per transaction) ─────────────────
CREATE TABLE IF NOT EXISTS `sales` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `branch_id`       TINYINT       NOT NULL DEFAULT 1,
  `total_amount`    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `amount_tendered` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `change_amount`   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_by`      INT           NULL,           -- FK to users.id
  `sale_date`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch_date` (`branch_id`, `sale_date`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Sale items (one row per product per sale) ──────────────
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `sale_id`    INT           NOT NULL,
  `product_id` INT           NOT NULL,
  `quantity`   INT           NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(10,2) NOT NULL,
  `subtotal`   DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`sale_id`)    REFERENCES `sales`(`id`)    ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── If you already had a sales table, add missing columns ──
-- ALTER TABLE `sales` ADD COLUMN `branch_id`       TINYINT       NOT NULL DEFAULT 1 AFTER `id`;
-- ALTER TABLE `sales` ADD COLUMN `amount_tendered` DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `total_amount`;
-- ALTER TABLE `sales` ADD COLUMN `change_amount`   DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER `amount_tendered`;
-- ALTER TABLE `sales` ADD COLUMN `created_by`      INT NULL AFTER `change_amount`;
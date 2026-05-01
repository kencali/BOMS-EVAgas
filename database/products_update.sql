-- ============================================================
-- FILE: database/products_update.sql
-- PURPOSE: Update existing products table to support branches.
--          Also adds 'category' column if not present.
-- RUN ONCE in phpMyAdmin.
-- ============================================================

-- ── Create fresh (if not exists) ──────────────────────────
CREATE TABLE IF NOT EXISTS `products` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `branch_id`    TINYINT       NOT NULL DEFAULT 1,
  `product_name` VARCHAR(120)  NOT NULL,
  `category`     VARCHAR(60)   NOT NULL DEFAULT 'LPG Cylinder',
  `price`        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `stock`        INT           NOT NULL DEFAULT 0,
  `status`       ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at`   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch_status` (`branch_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── If table already exists, add missing columns ───────────
-- (Run only the ones you're missing, skip others)

-- ALTER TABLE `products` ADD COLUMN `branch_id` TINYINT NOT NULL DEFAULT 1 AFTER `id`;
-- ALTER TABLE `products` ADD COLUMN `category` VARCHAR(60) NOT NULL DEFAULT 'LPG Cylinder' AFTER `product_name`;

-- ── If your column is named 'stock_quantity' instead of 'stock' ──
-- ALTER TABLE `products` RENAME COLUMN `stock_quantity` TO `stock`;

-- ── Sample products ────────────────────────────────────────
INSERT INTO `products` (`branch_id`, `product_name`, `category`, `price`, `stock`) VALUES
(1, 'LPG 11kg Cylinder',  'LPG Cylinder', 850.00, 50),
(1, 'LPG 22kg Cylinder',  'LPG Cylinder', 1650.00, 20),
(1, 'LPG Regulator',      'Accessories',  250.00, 30),
(1, 'LPG Hose (1m)',       'Accessories',  180.00, 25),
(2, 'LPG 11kg Cylinder',  'LPG Cylinder', 850.00, 40),
(2, 'LPG 22kg Cylinder',  'LPG Cylinder', 1650.00, 15),
(2, 'LPG Regulator',      'Accessories',  250.00, 20);
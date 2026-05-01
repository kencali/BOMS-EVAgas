-- ============================================================
-- FILE: database/expenses_update.sql
-- PLACE IN: /database/expenses_update.sql
-- RUN: Once in phpMyAdmin.
--
-- COLUMN NAMES used verbatim in api/expenses/index.php:
--   id, branch_id, category, description, amount,
--   expense_date, created_by, created_at
--
-- CATEGORY VALUES (enforced client-side only, not ENUM so it's flexible):
--   'Utilities' | 'Supplies' | 'Maintenance' | 'Salary' | 'Other'
-- ============================================================

CREATE TABLE IF NOT EXISTS `expenses` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `branch_id`    TINYINT       NOT NULL DEFAULT 1,
  `category`     VARCHAR(60)   NOT NULL DEFAULT 'Other',
  `description`  TEXT          NOT NULL,
  `amount`       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `expense_date` DATE          NOT NULL,
  `created_by`   INT           NULL,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch_date` (`branch_id`, `expense_date`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── If table already exists, add missing columns ───────────
-- ALTER TABLE `expenses` ADD COLUMN `branch_id`    TINYINT      NOT NULL DEFAULT 1     AFTER `id`;
-- ALTER TABLE `expenses` ADD COLUMN `category`     VARCHAR(60)  NOT NULL DEFAULT 'Other' AFTER `branch_id`;
-- ALTER TABLE `expenses` ADD COLUMN `expense_date` DATE         NOT NULL               AFTER `amount`;
-- ALTER TABLE `expenses` ADD COLUMN `created_by`   INT          NULL                   AFTER `expense_date`;

-- ── Sample data ────────────────────────────────────────────
INSERT INTO `expenses` (`branch_id`, `category`, `description`, `amount`, `expense_date`) VALUES
(1, 'Utilities',   'Meralco bill - January',        2500.00, '2025-01-31'),
(1, 'Supplies',    'LPG tank maintenance supplies',  800.00, '2025-01-15'),
(1, 'Maintenance', 'Delivery motorcycle repair',    1200.00, '2025-01-20'),
(2, 'Utilities',   'Meralco bill - January',        2200.00, '2025-01-31'),
(2, 'Supplies',    'Office supplies',                350.00, '2025-01-10');
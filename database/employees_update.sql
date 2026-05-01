-- ============================================================
-- FILE: database/employees_update.sql
-- PLACE IN: /database/employees_update.sql
-- RUN: Once in phpMyAdmin before testing the employees page.
--
-- NOTE: This is a separate table from `users`.
--   users     = login accounts (who can access the system)
--   employees = HR records (salary, position, hire date)
--   They are separate because not every employee needs
--   a login account (e.g. a driver with no system access).
--
-- COLUMN NAMES used verbatim in api/employees/index.php:
--   id, branch_id, full_name, position, phone,
--   address, hire_date, daily_rate, status, created_at
--
-- STATUS VALUES: 'Active' | 'Inactive'
-- ============================================================

CREATE TABLE IF NOT EXISTS `employees` (
  `id`         INT           NOT NULL AUTO_INCREMENT,
  `branch_id`  TINYINT       NOT NULL DEFAULT 1,
  `full_name`  VARCHAR(100)  NOT NULL,
  `position`   VARCHAR(80)   NOT NULL DEFAULT 'Staff',
  `phone`      VARCHAR(20)   NOT NULL DEFAULT '',
  `address`    TEXT          NOT NULL DEFAULT '',
  `hire_date`  DATE          NOT NULL,
  `daily_rate` DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  `status`     ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch_status` (`branch_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── If employees table already exists, add missing columns ─
-- Run only the lines for columns you don't have yet:

-- ALTER TABLE `employees` ADD COLUMN `branch_id`  TINYINT      NOT NULL DEFAULT 1      AFTER `id`;
-- ALTER TABLE `employees` ADD COLUMN `position`   VARCHAR(80)  NOT NULL DEFAULT 'Staff' AFTER `full_name`;
-- ALTER TABLE `employees` ADD COLUMN `phone`      VARCHAR(20)  NOT NULL DEFAULT ''      AFTER `position`;
-- ALTER TABLE `employees` ADD COLUMN `address`    TEXT         NOT NULL                 AFTER `phone`;
-- ALTER TABLE `employees` ADD COLUMN `daily_rate` DECIMAL(8,2) NOT NULL DEFAULT 0.00   AFTER `hire_date`;
-- ALTER TABLE `employees` MODIFY COLUMN `status`
--     ENUM('Active','Inactive') NOT NULL DEFAULT 'Active';

-- ── Sample records for testing ─────────────────────────────
INSERT INTO `employees`
  (`branch_id`, `full_name`, `position`, `phone`, `address`, `hire_date`, `daily_rate`, `status`)
VALUES
  
  (1, 'SuperAdvisor Person A',   'Supervisor', '09181234567', 'Brgy. 2, Malilipot, Albay', '2022-06-01', 700.00, 'Active'),
  (1, 'Deliverer Person A',    'Deliverer',  '09191234567', 'Brgy. 3, Malilipot, Albay', '2023-03-10', 500.00, 'Active'),
  (2, 'Deliverer Person B',    'Deliverer',  '09211234567', 'Brgy. 2, Legazpi, Albay',   '2023-07-01', 500.00, 'Active');
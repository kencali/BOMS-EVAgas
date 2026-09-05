-- ============================================================
-- FILE: database/payroll_update.sql
-- PLACE IN: /database/payroll_update.sql
-- RUN: Once in phpMyAdmin.
--
-- LOGIC:
--   Payroll is computed per employee per period (e.g. semi-monthly).
--   Formula: gross_pay = days_worked × daily_rate
--            net_pay   = gross_pay - deductions
--
-- COLUMN NAMES used verbatim in api/payroll/index.php:
--   id, branch_id, employee_id, period_start, period_end,
--   days_worked, daily_rate, gross_pay, deductions, net_pay,
--   status, created_by, created_at
--
-- STATUS VALUES: 'Draft' | 'Released'
-- ============================================================

CREATE TABLE IF NOT EXISTS `payroll` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `branch_id`    TINYINT       NOT NULL DEFAULT 1,
  `employee_id`  INT           NOT NULL,
  `period_start` DATE          NOT NULL,
  `period_end`   DATE          NOT NULL,
  `days_worked`  DECIMAL(4,1)  NOT NULL DEFAULT 0,
  `daily_rate`   DECIMAL(8,2)  NOT NULL DEFAULT 0,
  `gross_pay`    DECIMAL(10,2) NOT NULL DEFAULT 0,
  `deductions`   DECIMAL(10,2) NOT NULL DEFAULT 0,
  `net_pay`      DECIMAL(10,2) NOT NULL DEFAULT 0,
  `status`       ENUM('Draft','Released') NOT NULL DEFAULT 'Draft',
  `created_by`   INT           NULL,
  `created_at`   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_branch_period`   (`branch_id`, `period_start`),
  INDEX `idx_employee_period` (`employee_id`, `period_start`),
  FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`created_by`)  REFERENCES `users`(`id`)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
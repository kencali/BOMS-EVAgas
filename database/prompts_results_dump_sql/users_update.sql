-- ============================================================
-- FILE: database/users_update.sql
-- PURPOSE: Update your existing users table to support
--          3 roles and 2 branches.
--
-- RUN THIS IN YOUR MySQL/phpMyAdmin ONLY ONCE.
-- If you have existing users, the ALTER TABLE adds the columns.
-- ============================================================

-- ── If starting fresh, create the table ───────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT          NOT NULL AUTO_INCREMENT,
  `username`   VARCHAR(60)  NOT NULL UNIQUE,
  `password`   VARCHAR(255) NOT NULL,          -- always hashed with password_hash()
  `role`       ENUM('admin','employee','deliverer') NOT NULL DEFAULT 'employee',
  `branch_id`  TINYINT      NOT NULL DEFAULT 1, -- 1 = Branch A, 2 = Branch B
  `full_name`  VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── If you already have a users table, add missing columns ─
-- (Run one at a time, skip any that already exist)

-- ALTER TABLE `users` ADD COLUMN `role`      ENUM('admin','employee','deliverer') NOT NULL DEFAULT 'employee' AFTER `password`;
-- ALTER TABLE `users` ADD COLUMN `branch_id` TINYINT NOT NULL DEFAULT 1 AFTER `role`;
-- ALTER TABLE `users` ADD COLUMN `full_name` VARCHAR(100) NOT NULL DEFAULT '' AFTER `branch_id`;

-- ── Sample users for testing ───────────────────────────────
-- Passwords below are: "password123" (hashed)
-- Generate your own at: https://bcrypt-generator.com/ (cost 10)

INSERT INTO `users` (`username`, `password`, `role`, `branch_id`, `full_name`) VALUES
('admin_a',    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',     1, 'Eva Santos (Branch A)'),
('admin_b',    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin',     2, 'Eva Santos (Branch B)'),
('staff1',     '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee',  1, 'Juan Dela Cruz'),
('staff2',     '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee',  2, 'Maria Garcia'),
('rider1',     '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'deliverer', 1, 'Pedro Reyes'),
('rider2',     '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'deliverer', 2, 'Carlo Bautista');

-- ── PASSWORD NOTE ──────────────────────────────────────────
-- Your existing passwords from password_hash() still work.
-- The login.php uses password_verify() which matches them.
-- No need to reset existing user passwords.
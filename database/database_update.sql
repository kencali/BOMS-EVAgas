-- File: database/updates_v2.sql
-- Place in: /database/updates_v2.sql
-- Run this once in phpMyAdmin after your existing tables are set up.
-- This adds the new columns needed for Phase 2 features.

-- Add reference number to sales (format: BOMS-20260426-0001)
ALTER TABLE `sales`
    ADD COLUMN `reference_no` VARCHAR(30) NULL AFTER `id`,
    ADD COLUMN `sale_type` ENUM('walk-in','delivery','exchange') NOT NULL DEFAULT 'walk-in' AFTER `change_amount`,
    ADD COLUMN `delivery_id` INT NULL AFTER `sale_type`;

-- Make reference_no unique so we never duplicate receipts
ALTER TABLE `sales` ADD UNIQUE KEY `uq_reference_no` (`reference_no`);

-- Add sale_confirmed so delivery -> sale is a two-step process
-- 0 = delivery done but sale not yet confirmed, 1 = sale recorded
ALTER TABLE `deliveries`
    ADD COLUMN `sale_confirmed` TINYINT(1) NOT NULL DEFAULT 0 AFTER `delivered_at`;

-- Add Voided status to deliveries for accidental marks
ALTER TABLE `deliveries`
    MODIFY COLUMN `delivery_status`
    ENUM('Pending','On the way','Delivered','Cancelled','Voided') NOT NULL DEFAULT 'Pending';

-- Add exchange_price to products (null means no exchange discount, uses regular price)
ALTER TABLE `products`
    ADD COLUMN `exchange_price` DECIMAL(10,2) NULL AFTER `price`;

-- Backfill existing sales with a generated reference number
-- This updates rows that have no reference_no yet
UPDATE `sales`
SET `reference_no` = CONCAT(
    'BOMS-',
    DATE_FORMAT(`sale_date`, '%Y%m%d'),
    '-',
    LPAD(`id`, 4, '0')
)
WHERE `reference_no` IS NULL;
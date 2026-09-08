-- DEV-002: A delivery can create at most one linked sale.
-- Apply once after confirming no duplicate non-NULL delivery_id values exist.
ALTER TABLE `sales`
    ADD UNIQUE KEY `uq_sales_delivery_id` (`delivery_id`);

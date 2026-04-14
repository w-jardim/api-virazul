-- Migration 022: Add subscription and payment control fields to users

SET @has_subscription = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'users'
     AND column_name = 'subscription'
);
SET @sql = IF(
  @has_subscription = 0,
  'ALTER TABLE users ADD COLUMN subscription VARCHAR(50) NOT NULL DEFAULT \'free\' AFTER role',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_payment_status = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'users'
     AND column_name = 'payment_status'
);
SET @sql = IF(
  @has_payment_status = 0,
  'ALTER TABLE users ADD COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT \'pending\' AFTER subscription',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_payment_due_date = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'users'
     AND column_name = 'payment_due_date'
);
SET @sql = IF(
  @has_payment_due_date = 0,
  'ALTER TABLE users ADD COLUMN payment_due_date DATE NULL DEFAULT NULL AFTER payment_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

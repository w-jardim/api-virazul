SET @has_payment_status = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'users'
     AND column_name = 'payment_status'
);

SET @sql = IF(
  @has_payment_status = 1,
  'ALTER TABLE users MODIFY COLUMN payment_status VARCHAR(50) NULL DEFAULT NULL',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

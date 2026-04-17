-- Migration 023: Add status column to users
SET @has_status = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'users'
     AND column_name = 'status'
);
SET @sql = IF(
  @has_status = 0,
  'ALTER TABLE users ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT \'active\' AFTER role',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

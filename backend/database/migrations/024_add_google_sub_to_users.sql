-- Migration 024: Add Google account link column to users

SET @has_google_sub = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'users'
     AND column_name = 'google_sub'
);
SET @sql = IF(
  @has_google_sub = 0,
  'ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) NULL DEFAULT NULL AFTER email',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_google_sub_index = (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'users'
     AND index_name = 'uq_users_google_sub'
);
SET @sql = IF(
  @has_google_sub_index = 0,
  'ALTER TABLE users ADD UNIQUE INDEX uq_users_google_sub (google_sub)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

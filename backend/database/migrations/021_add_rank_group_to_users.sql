-- Migration 021: Add rank_group to users table
-- Allows the system to resolve pricing base values per user rank

SET @has_rank_group = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'users'
     AND column_name = 'rank_group'
);
SET @sql = IF(
  @has_rank_group = 0,
  'ALTER TABLE users ADD COLUMN rank_group VARCHAR(100) NULL DEFAULT NULL AFTER role',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

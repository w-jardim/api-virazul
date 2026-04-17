-- Add schedule_template column to user_preferences
-- Stores the user's recurring work schedule pattern (WEEKLY, BIWEEKLY or INTERVAL)
-- Used by the frontend to compute and display work days / folgas on all calendars

SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'user_preferences'
     AND column_name = 'schedule_template'
);

SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE user_preferences ADD COLUMN schedule_template JSON NULL AFTER planning_preferences',
  'SELECT 1'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

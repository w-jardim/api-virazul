-- Add monthly_hour_goal if not exists
SET @col_exists := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'user_preferences'
     AND column_name = 'monthly_hour_goal'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE user_preferences ADD COLUMN monthly_hour_goal INT NULL AFTER notification_prefs',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add planning_preferences if not exists
SET @col_exists2 := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'user_preferences'
     AND column_name = 'planning_preferences'
);
SET @sql2 := IF(
  @col_exists2 = 0,
  'ALTER TABLE user_preferences ADD COLUMN planning_preferences JSON NULL AFTER monthly_hour_goal',
  'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

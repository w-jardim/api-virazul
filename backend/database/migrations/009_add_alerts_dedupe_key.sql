SET @column_exists := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'alerts'
     AND column_name = 'dedupe_key'
);
SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE alerts ADD COLUMN dedupe_key VARCHAR(191) NULL AFTER related_service_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE alerts
   SET dedupe_key = CONCAT('legacy|', id)
 WHERE dedupe_key IS NULL;

SET @null_count := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'alerts'
     AND column_name = 'dedupe_key'
     AND is_nullable = 'YES'
);
SET @sql := IF(
  @null_count > 0,
  'ALTER TABLE alerts MODIFY COLUMN dedupe_key VARCHAR(191) NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'alerts'
     AND index_name = 'ux_alerts_dedupe_key'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX ux_alerts_dedupe_key ON alerts (dedupe_key)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

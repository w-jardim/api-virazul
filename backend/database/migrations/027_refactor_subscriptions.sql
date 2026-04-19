-- Migration 027: Evolve subscriptions table with gateway and billing cycle columns

SET @has_gateway = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'subscriptions' AND column_name = 'gateway'
);
SET @sql = IF(@has_gateway = 0,
  'ALTER TABLE subscriptions ADD COLUMN gateway VARCHAR(50) NULL DEFAULT NULL AFTER plan',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_gwcid = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'subscriptions' AND column_name = 'gateway_customer_id'
);
SET @sql = IF(@has_gwcid = 0,
  'ALTER TABLE subscriptions ADD COLUMN gateway_customer_id VARCHAR(255) NULL DEFAULT NULL AFTER gateway',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_gwsid = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'subscriptions' AND column_name = 'gateway_subscription_id'
);
SET @sql = IF(@has_gwsid = 0,
  'ALTER TABLE subscriptions ADD COLUMN gateway_subscription_id VARCHAR(255) NULL DEFAULT NULL AFTER gateway_customer_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_tet = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'subscriptions' AND column_name = 'trial_ends_at'
);
SET @sql = IF(@has_tet = 0,
  'ALTER TABLE subscriptions ADD COLUMN trial_ends_at TIMESTAMP NULL DEFAULT NULL AFTER expires_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_cps = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'subscriptions' AND column_name = 'current_period_start'
);
SET @sql = IF(@has_cps = 0,
  'ALTER TABLE subscriptions ADD COLUMN current_period_start TIMESTAMP NULL DEFAULT NULL AFTER trial_ends_at',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_cpe = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'subscriptions' AND column_name = 'current_period_end'
);
SET @sql = IF(@has_cpe = 0,
  'ALTER TABLE subscriptions ADD COLUMN current_period_end TIMESTAMP NULL DEFAULT NULL AFTER current_period_start',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_cat = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'subscriptions' AND column_name = 'canceled_at'
);
SET @sql = IF(@has_cat = 0,
  'ALTER TABLE subscriptions ADD COLUMN canceled_at TIMESTAMP NULL DEFAULT NULL AFTER current_period_end',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

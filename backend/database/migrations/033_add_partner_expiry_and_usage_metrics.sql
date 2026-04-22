-- Migration 033: Add partner_expires_at to subscriptions + create usage_metrics

SET @has_partner_expires = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'subscriptions'
     AND column_name = 'partner_expires_at'
);
SET @sql = IF(
  @has_partner_expires = 0,
  'ALTER TABLE subscriptions ADD COLUMN partner_expires_at TIMESTAMP NULL DEFAULT NULL AFTER canceled_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS usage_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  account_id INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  services_created INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usage (account_id, month, year),
  KEY idx_account_period (account_id, year, month)
);

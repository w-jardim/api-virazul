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

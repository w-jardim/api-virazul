CREATE TABLE IF NOT EXISTS alerts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  related_service_id BIGINT UNSIGNED NULL,
  payload JSON NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_alerts_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_alerts_related_service_id FOREIGN KEY (related_service_id) REFERENCES services(id),
  CONSTRAINT chk_alerts_type CHECK (alert_type IN ('DAY', 'OPERATIONAL', 'FINANCIAL')),
  CONSTRAINT chk_alerts_status CHECK (status IN ('ACTIVE', 'READ', 'DISMISSED')),
  INDEX idx_alerts_user_status (user_id, status),
  INDEX idx_alerts_user_type (user_id, alert_type),
  INDEX idx_alerts_user_service (user_id, related_service_id),
  INDEX idx_alerts_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

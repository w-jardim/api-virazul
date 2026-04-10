CREATE TABLE IF NOT EXISTS service_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  service_id BIGINT UNSIGNED NOT NULL,
  previous_operational_status VARCHAR(50) NULL,
  previous_financial_status VARCHAR(50) NULL,
  new_operational_status VARCHAR(50) NULL,
  new_financial_status VARCHAR(50) NULL,
  transition_type VARCHAR(100) NOT NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_status_history_service_id FOREIGN KEY (service_id) REFERENCES services(id),
  CONSTRAINT fk_service_status_history_changed_by FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_service_status_history_service_id (service_id),
  INDEX idx_service_status_history_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

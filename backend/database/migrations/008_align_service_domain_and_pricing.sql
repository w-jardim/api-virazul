SET @has_financial_snapshot = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'services'
     AND column_name = 'financial_snapshot'
);
SET @sql = IF(
  @has_financial_snapshot = 0,
  'ALTER TABLE services ADD COLUMN financial_snapshot JSON NULL AFTER amount_total',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_category_constraint = (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE table_schema = DATABASE()
     AND table_name = 'service_types'
     AND constraint_name = 'chk_service_types_category'
);
SET @sql = IF(
  @has_category_constraint > 0,
  'ALTER TABLE service_types DROP CHECK chk_service_types_category',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
ALTER TABLE service_types
  ADD CONSTRAINT chk_service_types_category
  CHECK (category IN ('ORDINARY', 'RAS', 'PROEIS', 'SEGURANCA_PRESENTE', 'OTHER'));

SET @has_operational_constraint = (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE table_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_operational_status'
);
SET @sql = IF(
  @has_operational_constraint > 0,
  'ALTER TABLE services DROP CHECK chk_services_operational_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
ALTER TABLE services
  ADD CONSTRAINT chk_services_operational_status
  CHECK (operational_status IN ('TITULAR', 'RESERVA', 'CONVERTIDO_TITULAR', 'REALIZADO', 'FALTOU', 'CANCELADO', 'NAO_CONVERTIDO'));

CREATE TABLE IF NOT EXISTS pricing_base_values (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rank_group VARCHAR(100) NOT NULL,
  duration_hours INT NOT NULL,
  base_amount DECIMAL(12,2) NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pricing_base_values_period (rank_group, duration_hours, effective_start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_type_financial_rules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  service_scope VARCHAR(100) NOT NULL,
  allow_transport TINYINT(1) NOT NULL DEFAULT 0,
  transport_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  allow_meal TINYINT(1) NOT NULL DEFAULT 0,
  meal_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_service_type_financial_rules_period (service_scope, effective_start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

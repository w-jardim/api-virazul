-- Service types category constraint
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'service_types'
     AND constraint_name = 'chk_service_types_category'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE service_types ADD CONSTRAINT chk_service_types_category CHECK (category IN (''ORDINARY'', ''RAS'', ''PROEIS'', ''OTHER''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Services duration constraint
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_duration_hours'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_duration_hours CHECK (duration_hours IN (6, 8, 12, 24))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Services operational status constraint
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_operational_status'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_operational_status CHECK (operational_status IN (''TITULAR'', ''RESERVA'', ''CONVERTIDO_TITULAR'', ''REALIZADO'', ''FALTOU'', ''CANCELADO'', ''NAO_CONVERTIDO''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Services financial status constraint
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_financial_status'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_financial_status CHECK (financial_status IN (''PREVISTO'', ''PAGO'', ''PAGO_PARCIAL'', ''NAO_PAGO''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Services amount integrity constraints
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_amount_total_non_negative'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_amount_total_non_negative CHECK (amount_total >= 0)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_amount_paid_non_negative'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_amount_paid_non_negative CHECK (amount_paid >= 0)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_amount_paid_lte_total'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_amount_paid_lte_total CHECK (amount_paid <= amount_total)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_amount_balance_non_negative'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_amount_balance_non_negative CHECK (amount_balance >= 0)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_amount_balance_formula'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_amount_balance_formula CHECK (amount_balance = ROUND(amount_total - amount_paid, 2))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

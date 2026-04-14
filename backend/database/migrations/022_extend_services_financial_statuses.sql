-- Drop existing financial status constraint if present
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_financial_status'
);
SET @sql := IF(
  @constraint_exists > 0,
  'ALTER TABLE services DROP CHECK chk_services_financial_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Recreate financial status constraint with calendar-driven states
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_financial_status'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_financial_status CHECK (financial_status IN (''PREVISTO'', ''PENDENTE'', ''EM_ATRASO'', ''PAGO'', ''PAGO_PARCIAL'', ''NAO_PAGO''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

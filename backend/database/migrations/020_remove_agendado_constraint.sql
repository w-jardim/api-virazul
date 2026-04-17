-- Drop existing operational_status constraint if present
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_operational_status'
);
SET @sql := IF(
  @constraint_exists > 0,
  'ALTER TABLE services DROP CHECK chk_services_operational_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add operational_status constraint without 'AGENDADO'
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

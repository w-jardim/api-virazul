-- Canonicalize legacy service financial statuses into the simplified model
UPDATE services
SET
  financial_status = CASE
    WHEN financial_status IN ('PAGO', 'RECEBIDO') THEN 'RECEBIDO'
    ELSE 'PENDENTE'
  END,
  payment_due_date = NULL,
  version = version + 1
WHERE deleted_at IS NULL
  AND (
    financial_status NOT IN ('PENDENTE', 'RECEBIDO')
    OR payment_due_date IS NOT NULL
  );

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

-- Recreate financial status constraint with only PENDENTE / RECEBIDO
SET @constraint_exists := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'services'
     AND constraint_name = 'chk_services_financial_status'
);
SET @sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE services ADD CONSTRAINT chk_services_financial_status CHECK (financial_status IN (''PENDENTE'', ''RECEBIDO''))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

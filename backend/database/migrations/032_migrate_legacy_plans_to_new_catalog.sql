-- Migration 032: remove legacy plan codes from runtime data without breaking existing users
-- Maps old plan codes to new canonical plan codes.

-- 1) Normalize users.subscription
UPDATE users
SET subscription = 'plan_free'
WHERE subscription = 'free';

UPDATE users
SET subscription = 'plan_pro'
WHERE subscription IN ('trial', 'premium');

-- 2) Normalize subscriptions.plan
UPDATE subscriptions
SET plan = 'plan_free'
WHERE plan = 'free';

UPDATE subscriptions
SET plan = 'plan_pro'
WHERE plan IN ('trial', 'premium');

-- 3) Deactivate legacy plans in catalog
UPDATE plans
SET is_active = 0, updated_at = CURRENT_TIMESTAMP
WHERE code IN ('free', 'trial', 'premium');

-- 4) Ensure new plan catalog is active
UPDATE plans
SET is_active = 1, updated_at = CURRENT_TIMESTAMP
WHERE code IN ('plan_free', 'plan_starter', 'plan_pro', 'plan_partner');

-- 5) Update users.subscription default to new canonical free plan
SET @has_users_subscription = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'subscription'
);
SET @sql = IF(
  @has_users_subscription = 1,
  'ALTER TABLE users ALTER COLUMN subscription SET DEFAULT ''plan_free''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

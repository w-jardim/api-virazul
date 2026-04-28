-- Migration 034: normalize any remaining legacy plan codes in users/subscriptions

UPDATE users
SET subscription = CASE
  WHEN subscription IN ('free', 'local', 'preview', 'inicial') THEN 'plan_free'
  WHEN subscription IN ('starter') THEN 'plan_starter'
  WHEN subscription IN ('pro', 'premium', 'trial') THEN 'plan_pro'
  WHEN subscription IN ('partner', 'parceiro') THEN 'plan_partner'
  ELSE subscription
END
WHERE subscription IN (
  'free',
  'local',
  'preview',
  'inicial',
  'starter',
  'pro',
  'premium',
  'trial',
  'partner',
  'parceiro'
);

UPDATE subscriptions
SET plan = CASE
  WHEN plan IN ('free', 'local', 'preview', 'inicial') THEN 'plan_free'
  WHEN plan IN ('starter') THEN 'plan_starter'
  WHEN plan IN ('pro', 'premium', 'trial') THEN 'plan_pro'
  WHEN plan IN ('partner', 'parceiro') THEN 'plan_partner'
  ELSE plan
END
WHERE plan IN (
  'free',
  'local',
  'preview',
  'inicial',
  'starter',
  'pro',
  'premium',
  'trial',
  'partner',
  'parceiro'
);

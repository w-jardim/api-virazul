-- Migration 031: Add new SaaS plan catalog (phase 1)
-- Transitional strategy:
-- 1) Keep legacy codes (free/trial/premium) active for compatibility during rollout.
-- 2) Add new canonical codes: plan_free, plan_starter, plan_pro, plan_partner.

INSERT INTO plans (code, name, price_cents, currency, billing_cycle, is_active)
VALUES
  ('plan_free', 'Free', 0, 'BRL', 'free', 1),
  ('plan_starter', 'Starter', 99, 'BRL', 'monthly', 1),
  ('plan_pro', 'Pro', 299, 'BRL', 'monthly', 1),
  ('plan_partner', 'Partner', 0, 'BRL', 'free', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  price_cents = VALUES(price_cents),
  currency = VALUES(currency),
  billing_cycle = VALUES(billing_cycle),
  is_active = VALUES(is_active),
  updated_at = CURRENT_TIMESTAMP;

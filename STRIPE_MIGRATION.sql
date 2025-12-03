-- ===============================================
-- STRIPE MIGRATION - Add Stripe columns to subscriptions
-- ===============================================
-- Run this SQL in Supabase SQL Editor to add Stripe support

-- Add Stripe columns to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Add Stripe columns to subscription_plans table
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id 
ON subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id 
ON subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_id 
ON subscription_plans(stripe_price_id);

-- Note: Lemon Squeezy columns are kept for backward compatibility
-- You can remove them later if you're not using Lemon Squeezy:
-- ALTER TABLE subscriptions DROP COLUMN IF EXISTS lemon_squeezy_subscription_id;
-- ALTER TABLE subscriptions DROP COLUMN IF EXISTS lemon_squeezy_customer_id;
-- ALTER TABLE subscriptions DROP COLUMN IF EXISTS lemon_squeezy_order_id;
-- ALTER TABLE subscription_plans DROP COLUMN IF EXISTS lemon_squeezy_product_id;
-- ALTER TABLE subscription_plans DROP COLUMN IF EXISTS lemon_squeezy_variant_id;


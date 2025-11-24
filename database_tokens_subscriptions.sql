-- ===============================================
-- TOKEN & SUBSCRIPTION SYSTEM - DATABASE SCHEMA
-- ===============================================

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('free', 'monthly', 'sixMonth', 'annual')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'paused')),
    tokens_limit INTEGER NOT NULL DEFAULT 100000,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 month',
    lemon_squeezy_subscription_id TEXT,
    lemon_squeezy_customer_id TEXT,
    lemon_squeezy_order_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create token transactions table for audit trail
CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('grant', 'deduct', 'reset')),
    reason TEXT NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscription plans reference table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    interval TEXT NOT NULL CHECK (interval IN ('month', '6months', 'year')),
    tokens_per_period INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    lemon_squeezy_product_id TEXT,
    lemon_squeezy_variant_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default subscription plans
INSERT INTO subscription_plans (id, name, description, price, interval, tokens_per_period, is_active) VALUES
('free', 'Free Plan', 'Perfect for trying out the platform', 0.00, 'month', 0, true),
('monthly', 'Monthly Plan', '100,000 tokens per month', 9.99, 'month', 100000, true),
('sixMonth', '6-Month Plan', '100,000 tokens per month, billed every 6 months', 49.99, '6months', 100000, true),
('annual', 'Annual Plan', '100,000 tokens per month, billed annually', 99.99, 'year', 100000, true)
ON CONFLICT (id) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at DESC);

-- Trigger to update updated_at on subscriptions
CREATE TRIGGER update_subscriptions_updated_at 
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize subscription for new users (free plan with 0 tokens)
CREATE OR REPLACE FUNCTION initialize_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO subscriptions (user_id, plan_type, tokens_limit, tokens_used, status)
    VALUES (NEW.id, 'free', 0, 0, 'active');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create free subscription for new users
CREATE TRIGGER on_user_created_create_subscription
    AFTER INSERT ON profiles
    FOR EACH ROW 
    EXECUTE FUNCTION initialize_user_subscription();

-- Function to check if user has enough tokens (used in app logic)
CREATE OR REPLACE FUNCTION user_has_tokens(p_user_id UUID, p_required_tokens INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_available_tokens INTEGER;
BEGIN
    SELECT (tokens_limit - tokens_used) INTO v_available_tokens
    FROM subscriptions
    WHERE user_id = p_user_id AND status = 'active';
    
    RETURN COALESCE(v_available_tokens >= p_required_tokens, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's token balance
CREATE OR REPLACE FUNCTION get_user_token_balance(p_user_id UUID)
RETURNS TABLE (
    tokens_remaining INTEGER,
    tokens_limit INTEGER,
    tokens_used INTEGER,
    plan_type TEXT,
    status TEXT,
    period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (s.tokens_limit - s.tokens_used) as tokens_remaining,
        s.tokens_limit,
        s.tokens_used,
        s.plan_type,
        s.status,
        s.current_period_end as period_end
    FROM subscriptions s
    WHERE s.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for subscriptions table
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
    ON subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
    ON subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policies for token_transactions table
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own token transactions"
    ON token_transactions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policies for subscription_plans table (read-only for all)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subscription plans"
    ON subscription_plans FOR SELECT
    TO public
    USING (is_active = true);



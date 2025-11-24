# Lemon Squeezy Integration Setup

## Overview
This application uses Lemon Squeezy for subscription management. Currently in **DEMO MODE** - once your Lemon Squeezy account is approved, follow these steps to enable real payments.

## Demo Mode
- Users can click "Subscribe" on any plan and it will be activated instantly
- No actual payment is processed
- Perfect for testing the full user flow
- All token tracking, usage limits, and subscription features work as they will in production

## When Lemon Squeezy is Approved

### 1. Create Products in Lemon Squeezy

Log into your Lemon Squeezy dashboard and create 3 subscription products:

#### Monthly Plan
- **Name**: Monthly Subscription
- **Price**: $9.99/month
- **Recurring**: Yes, monthly
- **Description**: 100,000 tokens per month

#### 6-Month Plan
- **Name**: 6-Month Subscription  
- **Price**: $49.99 (billed every 6 months)
- **Recurring**: Yes, every 6 months
- **Description**: 100,000 tokens per month for 6 months

#### Annual Plan
- **Name**: Annual Subscription
- **Price**: $89.99/year
- **Recurring**: Yes, yearly
- **Description**: 100,000 tokens per month for 12 months

### 2. Get Your API Keys

From Lemon Squeezy dashboard:
1. Go to Settings → API
2. Copy your **Store ID**
3. Create an **API Key** and copy it
4. Note your **Webhook Secret** (we'll set this up next)

### 3. Update Environment Variables

Add to your `.env` file:

```bash
# Lemon Squeezy
VITE_LEMON_SQUEEZY_STORE_ID=your_store_id
LEMON_SQUEEZY_API_KEY=your_api_key
LEMON_SQUEEZY_WEBHOOK_SECRET=your_webhook_secret

# Product IDs (you'll get these after creating products)
LEMON_MONTHLY_PRODUCT_ID=123456
LEMON_SIXMONTH_PRODUCT_ID=123457
LEMON_ANNUAL_PRODUCT_ID=123458
```

### 4. Create Database Table for Lemon Squeezy IDs

Run this SQL in your Supabase SQL Editor:

```sql
-- Add Lemon Squeezy tracking columns to subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS lemon_subscription_id text,
ADD COLUMN IF NOT EXISTS lemon_customer_id text,
ADD COLUMN IF NOT EXISTS lemon_product_id text,
ADD COLUMN IF NOT EXISTS lemon_variant_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_lemon_subscription_id 
ON subscriptions(lemon_subscription_id);
```

### 5. Set Up Webhook Endpoint

You'll need a backend endpoint to receive Lemon Squeezy webhooks. Options:

#### Option A: Supabase Edge Function (Recommended)
```typescript
// supabase/functions/lemon-webhook/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Verify webhook signature
    const signature = req.headers.get('X-Signature')
    const secret = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET')
    
    const payload = await req.json()
    const eventName = payload.meta.event_name
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    switch (eventName) {
      case 'subscription_created':
        // Activate subscription
        await supabase.from('subscriptions').upsert({
          user_id: payload.meta.custom_data.user_id,
          plan_type: payload.meta.custom_data.plan_type,
          status: 'active',
          lemon_subscription_id: payload.data.id,
          lemon_customer_id: payload.data.attributes.customer_id,
          period_start: new Date(payload.data.attributes.created_at),
          period_end: new Date(payload.data.attributes.renews_at)
        })
        
        // Reset tokens
        const plan = await supabase.from('subscription_plans')
          .select('tokens_per_period')
          .eq('id', payload.meta.custom_data.plan_type)
          .single()
          
        await supabase.from('user_tokens').upsert({
          user_id: payload.meta.custom_data.user_id,
          tokens_remaining: plan.data.tokens_per_period,
          tokens_limit: plan.data.tokens_per_period,
          tokens_used: 0
        })
        break

      case 'subscription_updated':
        // Handle plan changes
        await supabase.from('subscriptions')
          .update({
            status: payload.data.attributes.status,
            period_end: new Date(payload.data.attributes.renews_at)
          })
          .eq('lemon_subscription_id', payload.data.id)
        break

      case 'subscription_cancelled':
        // Mark as cancelled but keep active until period end
        await supabase.from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('lemon_subscription_id', payload.data.id)
        break

      case 'subscription_expired':
        // Subscription ended, revert to free
        await supabase.from('subscriptions')
          .update({ 
            status: 'expired',
            plan_type: 'free'
          })
          .eq('lemon_subscription_id', payload.data.id)
          
        await supabase.from('user_tokens')
          .update({
            tokens_remaining: 0,
            tokens_limit: 0
          })
          .eq('user_id', payload.meta.custom_data.user_id)
        break

      case 'subscription_payment_success':
        // Payment successful, reset monthly tokens if it's renewal
        const { data: sub } = await supabase.from('subscriptions')
          .select('user_id, plan_type')
          .eq('lemon_subscription_id', payload.data.id)
          .single()
          
        const { data: planData } = await supabase.from('subscription_plans')
          .select('tokens_per_period')
          .eq('id', sub.plan_type)
          .single()
          
        await supabase.from('user_tokens')
          .update({
            tokens_remaining: planData.tokens_per_period,
            tokens_limit: planData.tokens_per_period,
            tokens_used: 0
          })
          .eq('user_id', sub.user_id)
        break

      case 'subscription_payment_failed':
        // Handle payment failure
        await supabase.from('subscriptions')
          .update({ status: 'past_due' })
          .eq('lemon_subscription_id', payload.data.id)
        break
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

Deploy the function:
```bash
supabase functions deploy lemon-webhook
```

#### Option B: Vercel/Netlify Serverless Function
Similar logic, adapted for your hosting platform.

### 6. Register Webhook in Lemon Squeezy

1. Go to Lemon Squeezy Dashboard → Settings → Webhooks
2. Click "Add Webhook"
3. Enter your webhook URL: `https://your-project.supabase.co/functions/v1/lemon-webhook`
4. Select events to listen for:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_payment_success`
   - `subscription_payment_failed`
5. Copy the webhook secret and add it to your `.env`

### 7. Update Frontend Checkout Function

Update `src/lib/supabase.ts` → `activateSubscription` function:

```typescript
activateSubscription: async (userId: string, planId: string) => {
  try {
    // In production, redirect to Lemon Squeezy checkout
    if (import.meta.env.PROD && import.meta.env.VITE_LEMON_SQUEEZY_STORE_ID) {
      // Get plan details
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single()

      // Create checkout URL
      const checkoutUrl = `https://your-store.lemonsqueezy.com/checkout/buy/${plan.lemon_product_id}?checkout[custom][user_id]=${userId}&checkout[custom][plan_type]=${planId}`
      
      // Redirect to Lemon Squeezy checkout
      window.location.href = checkoutUrl
      return { success: true }
    }
    
    // Demo mode: activate immediately
    // ... existing demo code ...
  } catch (error) {
    // ... error handling ...
  }
}
```

### 8. Add Success/Cancel Pages

Create return pages for after checkout:

- **Success page**: `/subscription-success`
  - Thank you message
  - Redirect to dashboard
  - Show token balance

- **Cancel page**: `/subscription-cancelled`
  - Message that subscription was cancelled
  - Link back to pricing

### 9. Test Webhooks

Lemon Squeezy provides test webhooks in their dashboard:
1. Go to Webhooks → Your webhook
2. Click "Send test webhook"
3. Check your logs to ensure it's received and processed correctly

### 10. Go Live Checklist

- [ ] All products created in Lemon Squeezy
- [ ] API keys added to production environment
- [ ] Webhook endpoint deployed and tested
- [ ] Webhook registered in Lemon Squeezy
- [ ] Success/cancel pages created
- [ ] Test purchase with real card
- [ ] Verify tokens are credited
- [ ] Test subscription renewal (use Lemon Squeezy test mode)
- [ ] Test cancellation flow
- [ ] Test webhook for all events

## Additional Token Purchase

For one-time token purchases (not subscriptions):

1. Create one-time products in Lemon Squeezy:
   - 10,000 tokens - $4.99
   - 50,000 tokens - $19.99
   - 100,000 tokens - $34.99

2. Handle webhook event `order_created`:
```typescript
case 'order_created':
  // Add tokens to user's balance (don't replace, add to existing)
  await supabase.rpc('add_tokens', {
    p_user_id: payload.meta.custom_data.user_id,
    p_amount: payload.meta.custom_data.token_amount
  })
  break
```

3. Create RPC function in Supabase:
```sql
CREATE OR REPLACE FUNCTION add_tokens(p_user_id uuid, p_amount integer)
RETURNS void AS $$
BEGIN
  UPDATE user_tokens
  SET 
    tokens_remaining = tokens_remaining + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;
```

## Support

- Lemon Squeezy Docs: https://docs.lemonsqueezy.com
- Lemon Squeezy Discord: https://discord.gg/lemonsqueezy
- Webhook Events: https://docs.lemonsqueezy.com/help/webhooks

## Current Status

✅ Database schema ready
✅ Token system implemented
✅ Demo mode active
✅ UI components ready
⏳ Waiting for Lemon Squeezy account approval
⏳ Webhook endpoint to be deployed
⏳ Production checkout to be enabled



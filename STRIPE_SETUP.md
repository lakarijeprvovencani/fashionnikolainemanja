# Stripe Integration Setup Guide

## Overview
This application uses Stripe for subscription management. Follow these steps to set up Stripe integration.

## Prerequisites
- Stripe account (create at https://stripe.com)
- Supabase project with Edge Functions enabled
- Environment variables configured

## Step 1: Install Dependencies

Dependencies are already added to `package.json`. Run:

```bash
npm install
```

This will install:
- `@stripe/stripe-js` - Stripe JavaScript SDK
- `@stripe/react-stripe-js` - React components for Stripe
- `stripe` - Stripe Node.js SDK (for Edge Functions)

## Step 2: Create Stripe Products and Prices

1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Products** → **Add Product**

### Create Products:

#### Monthly Plan
- **Name**: Monthly Subscription
- **Description**: 100,000 tokens per month
- **Pricing**: 
  - Price: $9.99
  - Billing period: Monthly (recurring)
- **Copy the Price ID** (starts with `price_...`)

#### 6-Month Plan
- **Name**: 6-Month Subscription
- **Description**: 100,000 tokens per month, billed every 6 months
- **Pricing**:
  - Price: $49.99
  - Billing period: Every 6 months (recurring)
- **Copy the Price ID**

#### Annual Plan
- **Name**: Annual Subscription
- **Description**: 100,000 tokens per month, billed annually
- **Pricing**:
  - Price: $99.99
  - Billing period: Yearly (recurring)
- **Copy the Price ID**

## Step 3: Get Stripe API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Copy your keys:
   - **Publishable key** (starts with `pk_test_...` or `pk_live_...`)
   - **Secret key** (starts with `sk_test_...` or `sk_live_...`)

**Note**: Use test keys (`pk_test_`, `sk_test_`) for development, and live keys (`pk_live_`, `sk_live_`) for production.

## Step 4: Set Up Webhook Endpoint

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Enter your webhook URL:
   ```
   https://YOUR_PROJECT_ID.supabase.co/functions/v1/stripe-webhook
   ```
   Replace `YOUR_PROJECT_ID` with your Supabase project ID.
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. **Copy the Signing secret** (starts with `whsec_...`)

## Step 5: Update Database Schema

Run the SQL migration file in Supabase SQL Editor:

```bash
# Open STRIPE_MIGRATION.sql in Supabase SQL Editor and run it
```

This will add Stripe columns to your `subscriptions` and `subscription_plans` tables.

## Step 6: Update Subscription Plans in Database

Update your subscription plans with Stripe Price IDs:

```sql
-- Update plans with Stripe Price IDs (replace with your actual Price IDs)
UPDATE subscription_plans 
SET stripe_price_id = 'price_xxxxx', stripe_product_id = 'prod_xxxxx'
WHERE id = 'monthly';

UPDATE subscription_plans 
SET stripe_price_id = 'price_xxxxx', stripe_product_id = 'prod_xxxxx'
WHERE id = 'sixMonth';

UPDATE subscription_plans 
SET stripe_price_id = 'price_xxxxx', stripe_product_id = 'prod_xxxxx'
WHERE id = 'annual';
```

## Step 7: Configure Environment Variables

### Frontend (.env file)

Add to your `.env` file:

```bash
# Stripe
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxx

# App URL (for redirects)
VITE_APP_URL=http://localhost:5454
```

### Supabase Edge Functions Secrets

Set these secrets in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# App URL
APP_URL=http://localhost:5454  # or your production URL
```

**To set secrets via CLI:**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx
supabase secrets set APP_URL=https://yourdomain.com
```

## Step 8: Deploy Edge Functions

Deploy the Stripe Edge Functions:

```bash
# Deploy webhook handler
supabase functions deploy stripe-webhook --no-verify-jwt

# Deploy checkout session creator
supabase functions deploy create-checkout-session --no-verify-jwt

# Deploy portal session creator
supabase functions deploy create-portal-session --no-verify-jwt
```

**Note**: `--no-verify-jwt` is used for webhook because Stripe signs the requests, not Supabase.

## Step 9: Test the Integration

### Test Mode (Development)

1. Use Stripe test keys (`pk_test_...`, `sk_test_...`)
2. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - 3D Secure: `4000 0027 6000 3184`
3. Test the checkout flow:
   - Click "Subscribe" on a plan
   - Complete checkout with test card
   - Verify subscription is created in database
   - Verify tokens are granted

### Production Mode

1. Switch to live keys (`pk_live_...`, `sk_live_...`)
2. Update environment variables
3. Redeploy Edge Functions
4. Test with real card (use small amount first)

## Step 10: Create Success/Cancel Pages

Create these pages in your app:

### `/subscription-success`
- Thank you message
- Show subscription details
- Link to dashboard

### `/subscription-cancelled`
- Message that checkout was cancelled
- Link back to pricing page

## Environment Variables Summary

### Frontend (.env)
```bash
VITE_STRIPE_PUBLIC_KEY=pk_test_xxxxx
VITE_APP_URL=http://localhost:5454
```

### Supabase Edge Functions (Secrets)
```bash
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
APP_URL=http://localhost:5454
```

## Testing Checklist

- [ ] Stripe products and prices created
- [ ] API keys added to environment variables
- [ ] Webhook endpoint configured
- [ ] Database schema updated
- [ ] Subscription plans updated with Stripe Price IDs
- [ ] Edge Functions deployed
- [ ] Test checkout flow works
- [ ] Webhook receives events
- [ ] Subscription created in database
- [ ] Tokens granted correctly
- [ ] Customer portal works (cancel subscription)

## Troubleshooting

### Webhook not receiving events
- Check webhook URL is correct
- Verify webhook secret matches
- Check Edge Function logs in Supabase Dashboard
- Use Stripe CLI to test webhooks locally: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`

### Checkout session not created
- Verify `STRIPE_SECRET_KEY` is set in Edge Function secrets
- Check Edge Function logs
- Verify user is authenticated

### Subscription not activating
- Check webhook is receiving `checkout.session.completed` event
- Verify webhook handler is processing correctly
- Check database for subscription record
- Verify Stripe Price IDs match in database

## Support

- Stripe Docs: https://stripe.com/docs
- Stripe API Reference: https://stripe.com/docs/api
- Supabase Edge Functions: https://supabase.com/docs/guides/functions

## Current Status

✅ Stripe libraries installed
✅ Database schema ready
✅ Edge Functions created
✅ Frontend components updated
⏳ Waiting for Stripe products/keys
⏳ Waiting for webhook configuration
⏳ Waiting for Edge Function deployment


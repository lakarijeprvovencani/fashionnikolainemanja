import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? 
                                Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!stripeSecretKey || !webhookSecret) {
      throw new Error('Missing Stripe configuration')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the signature from the request headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      throw new Error('No signature found')
    }

    // Get the raw body
    const body = await req.text()

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Webhook verified:', event.type)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.user_id
        const planType = session.metadata?.plan_type

        if (!userId || !planType) {
          console.error('Missing metadata in checkout session:', session.id)
          break
        }

        // Get subscription details
        const subscriptionId = session.subscription as string
        const customerId = session.customer as string

        // Get subscription from Stripe to get price_id
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId = subscription.items.data[0]?.price.id

        // Get plan details from database
        const { data: plan, error: planError } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('id', planType)
          .single()

        if (planError || !plan) {
          console.error('Plan not found:', planType)
          break
        }

        // Calculate period end
        const now = new Date()
        let periodEnd = new Date(now)
        if (plan.interval === 'month') {
          periodEnd.setMonth(periodEnd.getMonth() + 1)
        } else if (plan.interval === '6months') {
          periodEnd.setMonth(periodEnd.getMonth() + 6)
        } else if (plan.interval === 'year') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1)
        }

        // Update or create subscription
        const { error: subError } = await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            plan_type: planType,
            status: 'active',
            tokens_limit: plan.tokens_per_period,
            tokens_used: 0,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
          }, {
            onConflict: 'user_id'
          })

        if (subError) {
          console.error('Error updating subscription:', subError)
          break
        }

        // Log token grant transaction
        await supabase
          .from('token_transactions')
          .insert({
            user_id: userId,
            amount: plan.tokens_per_period,
            type: 'grant',
            reason: `Subscription activated: ${plan.name}`,
            balance_after: plan.tokens_per_period
          })

        console.log('✅ Subscription activated for user:', userId)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionId = subscription.id
        const customerId = subscription.customer as string

        // Find subscription in database
        const { data: existingSub, error: fetchError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', subscriptionId)
          .single()

        if (fetchError || !existingSub) {
          console.error('Subscription not found:', subscriptionId)
          break
        }

        // Update subscription status
        const status = subscription.status === 'active' ? 'active' : 
                      subscription.status === 'canceled' ? 'cancelled' :
                      subscription.status === 'past_due' ? 'paused' : 'expired'

        const periodEnd = new Date(subscription.current_period_end * 1000)

        await supabase
          .from('subscriptions')
          .update({
            status,
            current_period_end: periodEnd.toISOString(),
          })
          .eq('stripe_subscription_id', subscriptionId)

        console.log('✅ Subscription updated:', subscriptionId, status)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionId = subscription.id

        // Update subscription status to cancelled
        await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
          })
          .eq('stripe_subscription_id', subscriptionId)

        console.log('✅ Subscription cancelled:', subscriptionId)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (!subscriptionId) {
          // One-time payment, not subscription
          break
        }

        // Find subscription
        const { data: sub, error: subError } = await supabase
          .from('subscriptions')
          .select('*, subscription_plans(*)')
          .eq('stripe_subscription_id', subscriptionId)
          .single()

        if (subError || !sub) {
          console.error('Subscription not found for invoice:', subscriptionId)
          break
        }

        // Reset tokens for renewal
        const plan = sub.subscription_plans
        if (plan) {
          await supabase
            .from('subscriptions')
            .update({
              tokens_used: 0,
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(invoice.period_end * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', subscriptionId)

          // Log token reset transaction
          await supabase
            .from('token_transactions')
            .insert({
              user_id: sub.user_id,
              amount: plan.tokens_per_period,
              type: 'reset',
              reason: `Subscription renewed: ${plan.name}`,
              balance_after: plan.tokens_per_period
            })
        }

        console.log('✅ Payment succeeded, tokens reset:', subscriptionId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoice.subscription as string

        if (subscriptionId) {
          await supabase
            .from('subscriptions')
            .update({ status: 'paused' })
            .eq('stripe_subscription_id', subscriptionId)

          console.log('⚠️ Payment failed for subscription:', subscriptionId)
        }
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


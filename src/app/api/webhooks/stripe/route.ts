import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.instance.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        let status: 'active' | 'paused' | 'cancelled' = 'active'
        if (subscription.status === 'canceled') {
          status = 'cancelled'
        } else if (subscription.pause_collection) {
          status = 'paused'
        }

        await supabase
          .from('members')
          .update({
            subscription_status: status,
            subscription_id: subscription.id,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (member) {
          await supabase.from('subscription_history').insert({
            member_id: member.id,
            action: status === 'paused' ? 'paused' : status === 'cancelled' ? 'cancelled' : 'subscribed',
            stripe_event_id: event.id,
            metadata: { subscription_id: subscription.id },
          })
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        await supabase
          .from('members')
          .update({
            subscription_status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId)

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (member) {
          await supabase.from('subscription_history').insert({
            member_id: member.id,
            action: 'payment_succeeded',
            stripe_event_id: event.id,
            metadata: { invoice_id: invoice.id, amount: invoice.amount_paid },
          })
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (member) {
          await supabase.from('subscription_history').insert({
            member_id: member.id,
            action: 'payment_failed',
            stripe_event_id: event.id,
            metadata: { invoice_id: invoice.id },
          })
        }

        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

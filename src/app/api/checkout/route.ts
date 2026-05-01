import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone } = await req.json()
    const supabase = getSupabaseAdmin()

    const customer = await stripe.instance.customers.create({
      email,
      name,
      phone,
      metadata: { source: 'before-nine-club' },
    })

    const { data: member, error: memberError } = await supabase
      .from('members')
      .insert({
        email,
        full_name: name,
        phone,
        stripe_customer_id: customer.id,
        subscription_status: 'inactive',
      })
      .select()
      .single()

    if (memberError) {
      console.error('Member creation error:', memberError)
      return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
    }

    const session = await stripe.instance.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/join`,
      metadata: {
        member_id: member.id,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}

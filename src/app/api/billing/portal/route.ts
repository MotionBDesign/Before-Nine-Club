import { NextRequest, NextResponse } from 'next/server'
import { createBillingPortalSession } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { memberId } = await req.json()
    const supabase = getSupabaseAdmin()

    const { data: member, error } = await supabase
      .from('members')
      .select('stripe_customer_id')
      .eq('id', memberId)
      .single()

    if (error || !member?.stripe_customer_id) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    const session = await createBillingPortalSession(
      member.stripe_customer_id,
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    )

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Billing portal error:', err)
    return NextResponse.json({ error: 'Failed to create billing session' }, { status: 500 })
  }
}

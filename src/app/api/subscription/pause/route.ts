import { NextRequest, NextResponse } from 'next/server'
import { pauseSubscription, resumeSubscription } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { memberId, action } = await req.json()
    const supabase = getSupabaseAdmin()

    const { data: member, error } = await supabase
      .from('members')
      .select('subscription_id')
      .eq('id', memberId)
      .single()

    if (error || !member?.subscription_id) {
      return NextResponse.json({ error: 'Member or subscription not found' }, { status: 404 })
    }

    if (action === 'pause') {
      await pauseSubscription(member.subscription_id)
      await supabase
        .from('members')
        .update({ subscription_status: 'paused', updated_at: new Date().toISOString() })
        .eq('id', memberId)
    } else if (action === 'resume') {
      await resumeSubscription(member.subscription_id)
      await supabase
        .from('members')
        .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
        .eq('id', memberId)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Subscription update error:', err)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}

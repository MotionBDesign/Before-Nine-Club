import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()

    const { data: session } = await supabase
      .from('sessions')
      .select('member_id, expires_at')
      .eq('token', sessionToken)
      .single()

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
    }

    const { data: member } = await supabase
      .from('members')
      .select('id, email, full_name, is_admin, subscription_status')
      .eq('id', session.member_id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 401 })
    }

    return NextResponse.json({ member })
  } catch (err) {
    console.error('Session check error:', err)
    return NextResponse.json({ error: 'Session check failed' }, { status: 500 })
  }
}

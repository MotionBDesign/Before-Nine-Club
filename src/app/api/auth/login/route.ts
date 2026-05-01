import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const supabase = getSupabaseAdmin()

    const { data: member } = await supabase
      .from('members')
      .select('id, email, full_name')
      .eq('email', email.toLowerCase())
      .single()

    if (!member) {
      return NextResponse.json({ error: 'No member found with this email' }, { status: 404 })
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    const { error } = await supabase
      .from('login_tokens')
      .insert({
        member_id: member.id,
        token,
        expires_at: expiresAt,
      })

    if (error) {
      console.error('Token creation error:', error)
      return NextResponse.json({ error: 'Failed to create login token' }, { status: 500 })
    }

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify?token=${token}`

    // TODO: Send email with loginUrl using your email service
    // For now, log it (remove in production)
    console.log('Login URL:', loginUrl)

    return NextResponse.json({ success: true, message: 'Check your email for the login link' })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Failed to send login email' }, { status: 500 })
  }
}

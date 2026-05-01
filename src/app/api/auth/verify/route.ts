import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_token`)
    }

    const supabase = getSupabaseAdmin()

    const { data: loginToken } = await supabase
      .from('login_tokens')
      .select('member_id, expires_at, used')
      .eq('token', token)
      .single()

    if (!loginToken || loginToken.used) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_token`)
    }

    if (new Date(loginToken.expires_at) < new Date()) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=expired_token`)
    }

    await supabase
      .from('login_tokens')
      .update({ used: true })
      .eq('token', token)

    const sessionToken = crypto.randomBytes(32).toString('hex')
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await supabase
      .from('sessions')
      .insert({
        member_id: loginToken.member_id,
        token: sessionToken,
        expires_at: sessionExpires,
      })

    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`)
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('Verify error:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login?error=verification_failed`)
  }
}

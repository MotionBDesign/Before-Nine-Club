import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session')?.value

    if (sessionToken) {
      const supabase = getSupabaseAdmin()
      await supabase
        .from('sessions')
        .delete()
        .eq('token', sessionToken)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.delete('session')
    return response
  } catch (err) {
    console.error('Logout error:', err)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { memberId, eventId, status } = await req.json()
    const supabase = getSupabaseAdmin()

    if (!['yes', 'no', 'maybe'].includes(status)) {
      return NextResponse.json({ error: 'Invalid RSVP status' }, { status: 400 })
    }

    const { error } = await supabase
      .from('rsvps')
      .upsert({
        member_id: memberId,
        event_id: eventId,
        status,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'member_id,event_id',
      })

    if (error) {
      console.error('RSVP error:', error)
      return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('RSVP error:', err)
    return NextResponse.json({ error: 'Failed to save RSVP' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')
    const supabase = getSupabaseAdmin()

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('rsvps')
      .select(`
        *,
        members (id, full_name, email)
      `)
      .eq('event_id', eventId)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch RSVPs' }, { status: 500 })
    }

    return NextResponse.json({ rsvps: data })
  } catch (err) {
    console.error('RSVP fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch RSVPs' }, { status: 500 })
  }
}

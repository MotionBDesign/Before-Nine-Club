import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendEventReminderEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId } = await req.json()
    const supabase = getSupabaseAdmin()

    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const { data: members } = await supabase
      .from('members')
      .select('id, email, full_name')
      .eq('subscription_status', 'active')

    if (!members) {
      return NextResponse.json({ error: 'No active members' }, { status: 404 })
    }

    const { data: rsvps } = await supabase
      .from('rsvps')
      .select('member_id')
      .eq('event_id', eventId)

    const rsvpMemberIds = new Set(rsvps?.map(r => r.member_id) || [])

    const membersWithoutRsvp = members.filter(m => !rsvpMemberIds.has(m.id))

    const eventDate = new Date(event.event_date).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })

    let sent = 0
    for (const member of membersWithoutRsvp) {
      await sendEventReminderEmail(
        member.email,
        member.full_name,
        event.title,
        eventDate,
        event.location || 'TBA',
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      )
      sent++
    }

    return NextResponse.json({ success: true, sent })
  } catch (err) {
    console.error('Reminder error:', err)
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    return NextResponse.json({ events: data })
  } catch (err) {
    console.error('Events fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, eventDate, location, maxAttendees } = await req.json()
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('events')
      .insert({
        title,
        description,
        event_date: eventDate,
        location,
        max_attendees: maxAttendees || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Event creation error:', error)
      return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
    }

    return NextResponse.json({ event: data })
  } catch (err) {
    console.error('Event creation error:', err)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}

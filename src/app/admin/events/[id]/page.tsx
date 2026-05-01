'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type RSVP = {
  id: string
  status: 'yes' | 'no' | 'maybe'
  members: {
    id: string
    full_name: string
    email: string
  }
}

type Event = {
  id: string
  title: string
  description: string | null
  event_date: string
  location: string | null
  max_attendees: number | null
}

export default function EventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [rsvps, setRsvps] = useState<RSVP[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const sessionRes = await fetch('/api/auth/session')
        if (!sessionRes.ok) {
          router.push('/login')
          return
        }
        const { member } = await sessionRes.json()
        if (!member.is_admin) {
          router.push('/dashboard')
          return
        }

        const [eventsRes, rsvpsRes] = await Promise.all([
          fetch('/api/events'),
          fetch(`/api/rsvp?eventId=${id}`),
        ])

        if (eventsRes.ok) {
          const { events } = await eventsRes.json()
          const foundEvent = events.find((e: Event) => e.id === id)
          setEvent(foundEvent || null)
        }

        if (rsvpsRes.ok) {
          const { rsvps: rsvpData } = await rsvpsRes.json()
          setRsvps(rsvpData || [])
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [id, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Event not found</p>
          <Link href="/admin" className="text-amber-600 hover:underline">
            Back to Admin
          </Link>
        </div>
      </div>
    )
  }

  const attending = rsvps.filter(r => r.status === 'yes')
  const notAttending = rsvps.filter(r => r.status === 'no')
  const maybe = rsvps.filter(r => r.status === 'maybe')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <nav className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-amber-900">Before Nine Club</Link>
          <Link href="/admin" className="text-sm text-amber-600 hover:underline">
            Back to Admin
          </Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h1 className="text-2xl font-bold mb-2">{event.title}</h1>
          <p className="text-gray-600 mb-4">
            {new Date(event.event_date).toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {event.location && ` • ${event.location}`}
          </p>
          {event.description && (
            <p className="text-gray-700">{event.description}</p>
          )}
          {event.max_attendees && (
            <p className="text-sm text-gray-500 mt-2">
              Max attendees: {event.max_attendees} ({attending.length} confirmed)
            </p>
          )}
        </div>

        {/* RSVP Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-3xl font-bold text-green-600">{attending.length}</p>
            <p className="text-sm text-gray-600">Attending</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-3xl font-bold text-amber-600">{maybe.length}</p>
            <p className="text-sm text-gray-600">Maybe</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-3xl font-bold text-gray-600">{notAttending.length}</p>
            <p className="text-sm text-gray-600">Not Attending</p>
          </div>
        </div>

        {/* Attending List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 border-b bg-green-50">
            <h2 className="font-semibold text-green-800">Attending ({attending.length})</h2>
          </div>
          {attending.length === 0 ? (
            <p className="p-4 text-gray-500">No RSVPs yet</p>
          ) : (
            <ul className="divide-y">
              {attending.map(rsvp => (
                <li key={rsvp.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{rsvp.members.full_name}</p>
                    <p className="text-sm text-gray-600">{rsvp.members.email}</p>
                  </div>
                  <span className="text-green-600">&#10003;</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Maybe List */}
        {maybe.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b bg-amber-50">
              <h2 className="font-semibold text-amber-800">Maybe ({maybe.length})</h2>
            </div>
            <ul className="divide-y">
              {maybe.map(rsvp => (
                <li key={rsvp.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{rsvp.members.full_name}</p>
                    <p className="text-sm text-gray-600">{rsvp.members.email}</p>
                  </div>
                  <span className="text-amber-600">?</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Not Attending List */}
        {notAttending.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-700">Not Attending ({notAttending.length})</h2>
            </div>
            <ul className="divide-y">
              {notAttending.map(rsvp => (
                <li key={rsvp.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{rsvp.members.full_name}</p>
                    <p className="text-sm text-gray-600">{rsvp.members.email}</p>
                  </div>
                  <span className="text-gray-400">&#10007;</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'

type Event = {
  id: string
  title: string
  date: string
  location: string
  rsvpStatus: 'yes' | 'no' | 'pending'
}

const mockEvents: Event[] = [
  { id: '1', title: 'June Networking Breakfast', date: '2026-06-05', location: 'The Coffee House', rsvpStatus: 'pending' },
  { id: '2', title: 'July Networking Breakfast', date: '2026-07-03', location: 'The Coffee House', rsvpStatus: 'pending' },
]

export default function Dashboard() {
  const [subscription, setSubscription] = useState<'active' | 'paused'>('active')
  const [events, setEvents] = useState(mockEvents)

  const handleRSVP = (eventId: string, status: 'yes' | 'no') => {
    setEvents(events.map(e => e.id === eventId ? { ...e, rsvpStatus: status } : e))
  }

  const toggleSubscription = () => {
    setSubscription(subscription === 'active' ? 'paused' : 'active')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <nav className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-amber-900">Before Nine Club</Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, Member</span>
            <Link href="/login" className="text-sm text-amber-600 hover:underline">Logout</Link>
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Your Dashboard</h1>

        {/* Subscription Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Membership Status</h2>
              <p className={`text-sm ${subscription === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
                {subscription === 'active' ? 'Active' : 'Paused'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggleSubscription}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  subscription === 'active'
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {subscription === 'active' ? 'Pause Next Month' : 'Resume Subscription'}
              </button>
              <Link
                href="/billing"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                Manage Billing
              </Link>
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
          <div className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{event.title}</h3>
                  <p className="text-sm text-gray-600">
                    {new Date(event.date).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long'
                    })} &bull; {event.location}
                  </p>
                </div>
                <div className="flex gap-2">
                  {event.rsvpStatus === 'pending' ? (
                    <>
                      <button
                        onClick={() => handleRSVP(event.id, 'yes')}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition"
                      >
                        RSVP Yes
                      </button>
                      <button
                        onClick={() => handleRSVP(event.id, 'no')}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition"
                      >
                        Can&apos;t Make It
                      </button>
                    </>
                  ) : (
                    <span className={`px-4 py-2 rounded-lg text-sm ${
                      event.rsvpStatus === 'yes'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {event.rsvpStatus === 'yes' ? "You're going!" : 'Not attending'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  full_name: string
  email: string
  subscription_status: 'active' | 'paused' | 'cancelled' | 'inactive'
}

type Event = {
  id: string
  title: string
  event_date: string
  location: string | null
  rsvpStatus?: 'yes' | 'no' | 'maybe' | 'pending'
}

export default function Dashboard() {
  const router = useRouter()
  const [member, setMember] = useState<Member | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const sessionRes = await fetch('/api/auth/session')
        if (!sessionRes.ok) {
          router.push('/login')
          return
        }
        const { member: memberData } = await sessionRes.json()
        setMember(memberData)

        const eventsRes = await fetch('/api/events')
        if (eventsRes.ok) {
          const { events: eventsData } = await eventsRes.json()
          setEvents(eventsData.map((e: Event) => ({ ...e, rsvpStatus: 'pending' })))
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  const handleRSVP = async (eventId: string, status: 'yes' | 'no') => {
    if (!member) return
    setActionLoading(eventId)

    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, eventId, status }),
      })

      if (response.ok) {
        setEvents(events.map(e => e.id === eventId ? { ...e, rsvpStatus: status } : e))
      }
    } catch (err) {
      console.error('RSVP failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSubscriptionAction = async (action: 'pause' | 'resume') => {
    if (!member) return
    setActionLoading('subscription')

    try {
      const response = await fetch('/api/subscription/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, action }),
      })

      if (response.ok) {
        setMember({
          ...member,
          subscription_status: action === 'pause' ? 'paused' : 'active',
        })
      }
    } catch (err) {
      console.error('Subscription action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!member) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <nav className="max-w-4xl mx-auto p-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-amber-900">Before Nine Club</Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Hey, {member.full_name.split(' ')[0]}</span>
            <button onClick={handleLogout} className="text-sm text-amber-600 hover:underline">
              Logout
            </button>
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
              <p className={`text-sm ${
                member.subscription_status === 'active' ? 'text-green-600' :
                member.subscription_status === 'paused' ? 'text-amber-600' :
                'text-gray-600'
              }`}>
                {member.subscription_status.charAt(0).toUpperCase() + member.subscription_status.slice(1)}
              </p>
            </div>
            <div className="flex gap-3">
              {member.subscription_status === 'active' && (
                <button
                  onClick={() => handleSubscriptionAction('pause')}
                  disabled={actionLoading === 'subscription'}
                  className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition disabled:opacity-50"
                >
                  {actionLoading === 'subscription' ? 'Processing...' : 'Pause Next Month'}
                </button>
              )}
              {member.subscription_status === 'paused' && (
                <button
                  onClick={() => handleSubscriptionAction('resume')}
                  disabled={actionLoading === 'subscription'}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition disabled:opacity-50"
                >
                  {actionLoading === 'subscription' ? 'Processing...' : 'Resume Subscription'}
                </button>
              )}
              <button
                onClick={async () => {
                  const res = await fetch('/api/billing/portal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ memberId: member.id }),
                  })
                  const { url } = await res.json()
                  if (url) window.location.href = url
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
              >
                Manage Billing
              </button>
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Upcoming Events</h2>
          {events.length === 0 ? (
            <p className="text-gray-500">No upcoming events scheduled.</p>
          ) : (
            <div className="space-y-4">
              {events.map(event => (
                <div key={event.id} className="border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{event.title}</h3>
                    <p className="text-sm text-gray-600">
                      {new Date(event.event_date).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })} {event.location && `• ${event.location}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {event.rsvpStatus === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleRSVP(event.id, 'yes')}
                          disabled={actionLoading === event.id}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50"
                        >
                          RSVP Yes
                        </button>
                        <button
                          onClick={() => handleRSVP(event.id, 'no')}
                          disabled={actionLoading === event.id}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition disabled:opacity-50"
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
          )}
        </div>
      </main>
    </div>
  )
}

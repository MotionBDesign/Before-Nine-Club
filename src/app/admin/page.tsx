'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  full_name: string
  email: string
  subscription_status: 'active' | 'paused' | 'cancelled' | 'inactive'
  created_at: string
}

type Event = {
  id: string
  title: string
  event_date: string
  location: string | null
}

export default function AdminDashboard() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<{ full_name: string } | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'cancelled'>('all')
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
        setCurrentUser(member)

        const [membersRes, eventsRes] = await Promise.all([
          fetch('/api/members'),
          fetch('/api/events'),
        ])

        if (membersRes.ok) {
          const { members: membersData } = await membersRes.json()
          setMembers(membersData)
        }
        if (eventsRes.ok) {
          const { events: eventsData } = await eventsRes.json()
          setEvents(eventsData)
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const filteredMembers = filter === 'all'
    ? members
    : members.filter(m => m.subscription_status === filter)

  const stats = {
    total: members.length,
    active: members.filter(m => m.subscription_status === 'active').length,
    paused: members.filter(m => m.subscription_status === 'paused').length,
    inactive: members.filter(m => m.subscription_status === 'inactive' || m.subscription_status === 'cancelled').length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <nav className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-amber-900">Before Nine Club</Link>
          <div className="flex items-center gap-4">
            <span className="text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded">Admin</span>
            <span className="text-sm text-gray-600">{currentUser?.full_name}</span>
            <button onClick={handleLogout} className="text-sm text-amber-600 hover:underline">
              Logout
            </button>
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600">Total Members</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-3xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600">Paused</p>
            <p className="text-3xl font-bold text-amber-600">{stats.paused}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-600">Upcoming Events</p>
            <p className="text-3xl font-bold text-blue-600">{events.length}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-4 shadow-sm mb-6 flex gap-4">
          <Link
            href="/admin/events/new"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition"
          >
            Create Event
          </Link>
          <button
            onClick={() => alert('Coming soon: Send reminder to all members without RSVPs')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
          >
            Send Reminders
          </button>
          <button
            onClick={() => {
              const csv = [
                ['Name', 'Email', 'Status', 'Joined'].join(','),
                ...members.map(m => [
                  m.full_name,
                  m.email,
                  m.subscription_status,
                  new Date(m.created_at).toLocaleDateString(),
                ].join(','))
              ].join('\n')
              const blob = new Blob([csv], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'members.csv'
              a.click()
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
          >
            Export Members
          </button>
        </div>

        {/* Upcoming Events */}
        {events.length > 0 && (
          <div className="bg-white rounded-xl p-4 shadow-sm mb-6">
            <h2 className="text-lg font-semibold mb-3">Upcoming Events</h2>
            <div className="space-y-2">
              {events.slice(0, 3).map(event => (
                <div key={event.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(event.event_date).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="text-sm text-amber-600 hover:underline"
                  >
                    View RSVPs
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">Members</h2>
            <div className="flex gap-2">
              {(['all', 'active', 'paused', 'cancelled'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1 rounded text-sm ${
                    filter === status
                      ? 'bg-amber-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Email</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMembers.map(member => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{member.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">{member.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      member.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                      member.subscription_status === 'paused' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {member.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(member.created_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

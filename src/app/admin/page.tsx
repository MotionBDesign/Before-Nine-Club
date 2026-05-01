'use client'

import { useState } from 'react'
import Link from 'next/link'

type Member = {
  id: string
  name: string
  email: string
  status: 'active' | 'paused' | 'cancelled'
  lastPayment: string
  nextEvent: 'yes' | 'no' | 'pending'
}

const mockMembers: Member[] = [
  { id: '1', name: 'Sarah Johnson', email: 'sarah@example.com', status: 'active', lastPayment: '2026-05-01', nextEvent: 'yes' },
  { id: '2', name: 'Mike Chen', email: 'mike@example.com', status: 'active', lastPayment: '2026-05-01', nextEvent: 'pending' },
  { id: '3', name: 'Emma Wilson', email: 'emma@example.com', status: 'paused', lastPayment: '2026-04-01', nextEvent: 'no' },
  { id: '4', name: 'James Brown', email: 'james@example.com', status: 'active', lastPayment: '2026-05-01', nextEvent: 'yes' },
  { id: '5', name: 'Lisa Taylor', email: 'lisa@example.com', status: 'cancelled', lastPayment: '2026-03-01', nextEvent: 'no' },
]

export default function AdminDashboard() {
  const [members] = useState(mockMembers)
  const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'cancelled'>('all')

  const filteredMembers = filter === 'all'
    ? members
    : members.filter(m => m.status === filter)

  const stats = {
    total: members.length,
    active: members.filter(m => m.status === 'active').length,
    paused: members.filter(m => m.status === 'paused').length,
    attending: members.filter(m => m.nextEvent === 'yes').length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <nav className="max-w-6xl mx-auto p-4 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-amber-900">Before Nine Club</Link>
          <div className="flex items-center gap-4">
            <span className="text-sm bg-amber-100 text-amber-800 px-2 py-1 rounded">Admin</span>
            <Link href="/login" className="text-sm text-amber-600 hover:underline">Logout</Link>
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
            <p className="text-sm text-gray-600">Next Event RSVPs</p>
            <p className="text-3xl font-bold text-blue-600">{stats.attending}</p>
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
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            Send Reminder
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition">
            Export Members
          </button>
        </div>

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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Last Payment</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Next Event</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMembers.map(member => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{member.name}</td>
                  <td className="px-4 py-3 text-gray-600">{member.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      member.status === 'active' ? 'bg-green-100 text-green-700' :
                      member.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(member.lastPayment).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      member.nextEvent === 'yes' ? 'bg-green-100 text-green-700' :
                      member.nextEvent === 'pending' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {member.nextEvent === 'yes' ? 'Attending' :
                       member.nextEvent === 'pending' ? 'Pending' : 'Not attending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}

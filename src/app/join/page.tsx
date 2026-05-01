'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Join() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok && data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Failed to connect. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <Link href="/" className="text-xl font-bold text-amber-900 block text-center mb-2">
          Before Nine Club
        </Link>
        <h2 className="text-2xl font-semibold text-center mb-2">Join the Club</h2>
        <p className="text-gray-600 text-center mb-6">
          Monthly membership with the flexibility to pause anytime.
        </p>

        <div className="bg-amber-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">Monthly Membership</p>
              <p className="text-sm text-gray-600">Includes all breakfast events</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">£30</p>
              <p className="text-sm text-gray-600">/month</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              id="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone number (for reminders)
            </label>
            <input
              type="tel"
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition disabled:opacity-50"
          >
            {loading ? 'Redirecting to payment...' : 'Continue to Payment'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 mt-4">
          Secure payment powered by Stripe. Cancel anytime.
        </p>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already a member?{' '}
          <Link href="/login" className="text-amber-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

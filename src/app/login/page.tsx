'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // TODO: Implement Supabase magic link auth
    // await supabase.auth.signInWithOtp({ email })

    setTimeout(() => {
      setLoading(false)
      setSent(true)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <Link href="/" className="text-xl font-bold text-amber-900 block text-center mb-8">
          Before Nine Club
        </Link>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">&#9993;</div>
            <h2 className="text-xl font-semibold mb-2">Check your email</h2>
            <p className="text-gray-600">
              We&apos;ve sent a magic link to <strong>{email}</strong>. Click the link to sign in.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-center mb-6">Member Login</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </button>
            </form>
            <p className="text-center text-sm text-gray-600 mt-6">
              Not a member yet?{' '}
              <Link href="/join" className="text-amber-600 hover:underline">
                Join the club
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

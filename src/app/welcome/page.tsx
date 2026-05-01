import Link from 'next/link'

export default function Welcome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
        <div className="text-6xl mb-4">&#127881;</div>
        <h1 className="text-2xl font-bold mb-2">Welcome to the Club!</h1>
        <p className="text-gray-600 mb-6">
          Your membership is now active. You&apos;re all set to join our next breakfast event.
        </p>

        <div className="bg-amber-50 rounded-lg p-4 mb-6 text-left">
          <h2 className="font-semibold mb-2">What happens next?</h2>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-amber-600">&#10003;</span>
              Check your email for a login link
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600">&#10003;</span>
              RSVP to upcoming events in your dashboard
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-600">&#10003;</span>
              Join the WhatsApp group (link in welcome email)
            </li>
          </ul>
        </div>

        <Link
          href="/login"
          className="inline-block w-full py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition"
        >
          Go to Login
        </Link>
      </div>
    </div>
  )
}

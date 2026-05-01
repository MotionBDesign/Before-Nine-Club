import Link from "next/link"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="p-6">
        <nav className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-amber-900">Before Nine Club</h1>
          <Link
            href="/login"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
          >
            Member Login
          </Link>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Start Your Day Right
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Join our exclusive morning networking club. Connect with like-minded
            professionals before the workday begins.
          </p>
          <Link
            href="/join"
            className="inline-block px-8 py-4 bg-amber-600 text-white text-lg font-semibold rounded-lg hover:bg-amber-700 transition"
          >
            Join the Club
          </Link>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-3xl mb-4">&#9749;</div>
            <h3 className="text-lg font-semibold mb-2">Weekly Meetups</h3>
            <p className="text-gray-600">
              Regular breakfast sessions to grow your network and start your day energized.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-3xl mb-4">&#128197;</div>
            <h3 className="text-lg font-semibold mb-2">Easy RSVPs</h3>
            <p className="text-gray-600">
              Simple one-click RSVPs. Skip a month anytime — no questions asked.
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <div className="text-3xl mb-4">&#128176;</div>
            <h3 className="text-lg font-semibold mb-2">Flexible Billing</h3>
            <p className="text-gray-600">
              Pause or cancel your membership anytime. Only pay for the months you attend.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

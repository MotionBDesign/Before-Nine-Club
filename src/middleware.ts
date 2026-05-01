import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedRoutes = ['/dashboard', '/admin']
const adminRoutes = ['/admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('session')?.value

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute && !sessionToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (sessionToken && isProtectedRoute) {
    try {
      const response = await fetch(`${request.nextUrl.origin}/api/auth/session`, {
        headers: { Cookie: `session=${sessionToken}` },
      })

      if (!response.ok) {
        const loginUrl = new URL('/login', request.url)
        const res = NextResponse.redirect(loginUrl)
        res.cookies.delete('session')
        return res
      }

      const { member } = await response.json()

      const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
      if (isAdminRoute && !member.is_admin) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch {
      // Session check failed, let the page handle it
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
}

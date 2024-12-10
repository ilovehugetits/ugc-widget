import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createHash } from '@/lib/crypto'

export const config = {
  matcher: [
    '/api/videos/:path*',
    '/api/actors/:path*',
    '/videos/:path*',
    '/create/:path*'
  ]
}

const PROTECTED_ROUTES = [
  '/api/videos',
  '/api/actors',
  '/videos',
  '/create'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  // console.log('🔒 Middleware running for path:', pathname)

  if (!PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    console.log('↪️ Path not protected, skipping middleware')
    return NextResponse.next()
  }

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams)
    const { user_id, hash } = searchParams

    if (!user_id || !hash) {
      console.log('❌ Missing auth params, redirecting to root')
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Hash doğrulaması yap
    const secretKey = process.env.SECRET!
    const expectedHash = await createHash(user_id as string, secretKey)
    
    if (hash !== expectedHash) {
      console.log('❌ Invalid hash, redirecting to root')
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Auth parametrelerini header'lara ekle
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-external-id', user_id)
    requestHeaders.set('x-user-hash', hash)
    
    if (searchParams.subscription) {
      requestHeaders.set('x-user-subscription', searchParams.subscription)
    }

    // console.log('✅ Auth successful, proceeding with request')
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  } catch (error) {
    console.error('🚨 Auth error:', error)
    // return NextResponse.redirect(new URL('/', request.url))
  }
}
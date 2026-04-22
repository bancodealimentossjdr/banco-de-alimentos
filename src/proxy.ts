import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

// ⚠️ IMPORTANTE: tem que ser "export { auth as proxy }" no Next 16
export { auth as proxy }

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}

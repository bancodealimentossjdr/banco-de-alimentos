import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

// Middleware "leve" — só verifica JWT, não acessa banco
export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}

import type { NextAuthConfig } from 'next-auth'
import { canAccessRoute } from './permissions'
import type { UserRole } from '@/types/next-auth'

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id as string
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as UserRole
        session.user.id = token.id as string
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const userRole = auth?.user?.role as UserRole | undefined
      const { pathname } = nextUrl

      const publicRoutes = ['/login']
      const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))
      const isAuthApi = pathname.startsWith('/api/auth')

      if (isAuthApi) return true

      if (isLoggedIn && isPublicRoute) {
        return Response.redirect(new URL('/', nextUrl.origin))
      }

      if (!isLoggedIn && !isPublicRoute) {
        return false
      }

      if (isLoggedIn && !canAccessRoute(userRole, pathname)) {
  const deniedModule = pathname.split('/').filter(Boolean)[0] || 'pagina'
  const redirectUrl = new URL('/', nextUrl.origin)
  redirectUrl.searchParams.set('acesso_negado', deniedModule)
  return Response.redirect(redirectUrl)
}


      return true
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
}

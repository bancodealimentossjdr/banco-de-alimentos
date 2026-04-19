import type { NextAuthConfig } from 'next-auth'

/**
 * Configuração "leve" do NextAuth — compatível com Edge Runtime.
 * NÃO importa Prisma nem bcrypt (que não rodam em Edge).
 * Usado pelo middleware para verificar autenticação via JWT.
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  providers: [], // Providers ficam no auth.ts (que roda em Node.js runtime)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string
        session.user.id = token.id as string
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = nextUrl

      // Rotas públicas (não precisam de login)
      const publicRoutes = ['/login']
      const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

      // API de auth é pública
      const isAuthApi = pathname.startsWith('/api/auth')

      if (isAuthApi) return true

      // Se está logado e tenta acessar /login, redireciona para home
      if (isLoggedIn && isPublicRoute) {
        return Response.redirect(new URL('/', nextUrl.origin))
      }

      // Se não está logado e tenta acessar rota protegida, bloqueia
      // (NextAuth redireciona automaticamente para /login)
      if (!isLoggedIn && !isPublicRoute) {
        return false
      }

      return true
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
}

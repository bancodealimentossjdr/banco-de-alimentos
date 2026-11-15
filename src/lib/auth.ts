import NextAuth, { CredentialsSignin } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { authConfig } from './auth.config'
import { hitRateLimit, resetRateLimit } from './rate-limit'
import type { UserRole } from '@/types/next-auth'
import type { Adapter } from 'next-auth/adapters'

// G1-4 — limites do login por credenciais
const LOGIN_WINDOW_SEC = 15 * 60
const LOGIN_LIMIT_EMAIL = 5
const LOGIN_LIMIT_IP = 20

class RateLimitedError extends CredentialsSignin {
  code = 'rate_limited'
}

function getClientIp(request: Request | undefined): string {
  const forwarded = request?.headers?.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || 'unknown'
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const emailKey = email.trim().toLowerCase()
        const ip = getClientIp(request)

        // 🛡️ G1-4 — conta a tentativa ANTES de checar a senha
        const [byEmail, byIp] = await Promise.all([
          hitRateLimit('login:email', emailKey, LOGIN_LIMIT_EMAIL, LOGIN_WINDOW_SEC),
          hitRateLimit('login:ip', ip, LOGIN_LIMIT_IP, LOGIN_WINDOW_SEC),
        ])

        if (!byEmail.allowed || !byIp.allowed) {
          throw new RateLimitedError()
        }

        const user = await prisma.user.findUnique({
          where: { email },
        })

        if (!user || !user.active || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // Sucesso: zera o contador do e-mail (o do IP expira sozinho)
        await resetRateLimit('login:email', emailKey)

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as UserRole,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })

        if (existingUser && !existingUser.active) {
          return false
        }

        return true
      }

      return true
    },

    async jwt({ token, user }) {
      // Login inicial — garante id E email no token (email pode faltar no OAuth).
      if (user) {
        token.id = user.id
        token.email = user.email ?? token.email
        token.role = (user as { role?: UserRole }).role
      }

      // 🔑 FONTE DE VERDADE = BANCO. Relê role/active em TODO request.
      const lookupId = (token.id as string | undefined) ?? token.sub
      const lookupEmail = token.email as string | undefined

      const dbUser =
        (lookupId
          ? await prisma.user.findUnique({
              where: { id: lookupId },
              select: { id: true, email: true, role: true, active: true },
            })
          : null) ??
        (lookupEmail
          ? await prisma.user.findUnique({
              where: { email: lookupEmail },
              select: { id: true, email: true, role: true, active: true },
            })
          : null)

      if (dbUser) {
        if (!dbUser.active) return null // desativado → derruba sessão
        token.id = dbUser.id
        token.email = dbUser.email
        token.role = dbUser.role as UserRole
      }

      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        if (typeof token.id === 'string') {
          session.user.id = token.id
        }
        if (token.role) {
          session.user.role = token.role as UserRole
        }
      }
      return session
    },
  },
})

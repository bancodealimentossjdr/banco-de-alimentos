import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { authConfig } from './auth.config'
import type { UserRole } from '@/types/next-auth'
import type { Adapter } from 'next-auth/adapters'

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
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

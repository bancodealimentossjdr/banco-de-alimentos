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
    // 🆕 Login com Google
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // Login com email/senha (mantido)
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

    async jwt({ token, user, trigger }) {
      // Login inicial
      if (user) {
        token.id = user.id
        token.role = (user as { role?: UserRole }).role
      }

      // Atualiza role do banco em cada request (caso admin promova/desative)
      if (trigger === 'update' || (token.email && !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email as string },
          select: { id: true, role: true, active: true },
        })

        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role as UserRole
          if (!dbUser.active) return null
        }
      }

      return token
    },

    async session({ session, token }) {
      if (token && session.user) {
        // ✅ Narrowing com typeof — TypeScript entende que valor é definido
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

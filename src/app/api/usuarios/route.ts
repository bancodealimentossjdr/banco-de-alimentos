import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'
import type { UserRole } from '@/types/next-auth'

/**
 * GET /api/usuarios
 * Lista todos os usuários (apenas Admin)
 */
export async function GET() {
  const session = await auth()

  if (!isAdmin(session?.user?.role)) {
    return NextResponse.json(
      { error: 'Acesso negado. Apenas administradores.' },
      { status: 403 }
    )
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
      // ⚠️ password NUNCA retornado
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(users)
}

/**
 * POST /api/usuarios
 * Cria um novo usuário (apenas Admin)
 */
export async function POST(request: Request) {
  const session = await auth()

  if (!isAdmin(session?.user?.role)) {
    return NextResponse.json(
      { error: 'Acesso negado. Apenas administradores.' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { name, email, password, role, active } = body as {
      name: string
      email: string
      password: string
      role: UserRole
      active?: boolean
    }

    // Validações básicas
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Nome, email, senha e perfil são obrigatórios.' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres.' },
        { status: 400 }
      )
    }

    if (role !== 'admin' && role !== 'operador') {
      return NextResponse.json(
        { error: 'Perfil inválido. Use "admin" ou "operador".' },
        { status: 400 }
      )
    }

    // Verifica email duplicado
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um usuário com esse email.' },
        { status: 409 }
      )
    }

    // Cria usuário com senha hash
    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        active: active ?? true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno ao criar usuário.' },
      { status: 500 }
    )
  }
}

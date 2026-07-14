import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import type { UserRole } from '@/types/next-auth'

// ⚠️ 'dev' NÃO é atribuível via API — é role estrutural (só banco/seed).
// admin/dev PODEM gerenciar usuários, mas NÃO podem CRIAR outro 'dev'.
const VALID_ROLES: UserRole[] = ['admin', 'operador', 'visualizador']

/**
 * GET /api/usuarios
 * Lista todos os usuários (admin e dev).
 */
export async function GET() {
  try {
    const session = await auth()

    if (!session || !canEdit(session.user.role as UserRole, 'usuarios')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
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
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Erro GET usuários:', error)
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
  }
}

/**
 * POST /api/usuarios
 * Cria um novo usuário (admin e dev).
 */
export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session || !canEdit(session.user.role as UserRole, 'usuarios')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const body = await request.json()
    const { name, email, password, role } = body

    // Validações
    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      )
    }

    // 🔒 'dev' não é criável via API, mesmo por outro dev (role estrutural).
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Role inválida' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    // Checa se email já existe
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'Já existe um usuário com este email' },
        { status: 400 }
      )
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
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
    console.error('Erro POST usuário:', error)
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }
}

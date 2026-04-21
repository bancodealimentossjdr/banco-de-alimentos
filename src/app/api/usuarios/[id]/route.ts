import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/permissions'
import type { UserRole } from '@/types/next-auth'

/**
 * GET /api/usuarios/[id]
 * Busca um usuário específico (apenas Admin)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!isAdmin(session?.user?.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const { id } = await params

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
  }

  return NextResponse.json(user)
}

/**
 * PATCH /api/usuarios/[id]
 * Atualiza um usuário (apenas Admin)
 * Senha é opcional: se vier, atualiza; se não, mantém a antiga
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!isAdmin(session?.user?.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await request.json()
    const { name, email, password, role, active } = body as {
      name?: string
      email?: string
      password?: string
      role?: UserRole
      active?: boolean
    }

    // Impede admin de desativar ele mesmo (previne lock-out)
    if (session?.user?.id === id && active === false) {
      return NextResponse.json(
        { error: 'Você não pode desativar sua própria conta.' },
        { status: 400 }
      )
    }

    // Impede admin de mudar o próprio role (previne perder acesso)
    if (session?.user?.id === id && role && role !== 'admin') {
      return NextResponse.json(
        { error: 'Você não pode remover seu próprio perfil de administrador.' },
        { status: 400 }
      )
    }

    // Se mudou email, verifica duplicação
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: 'Já existe um usuário com esse email.' },
          { status: 409 }
        )
      }
    }

    // Monta o update dinâmico
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (role !== undefined) data.role = role
    if (active !== undefined) data.active = active

    if (password) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'A senha deve ter pelo menos 6 caracteres.' },
          { status: 400 }
        )
      }
      data.password = await bcrypt.hash(password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    return NextResponse.json(
      { error: 'Erro interno ao atualizar usuário.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/usuarios/[id]
 * Remove um usuário (apenas Admin)
 * Impede auto-exclusão
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!isAdmin(session?.user?.role)) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const { id } = await params

  // Impede auto-exclusão
  if (session?.user?.id === id) {
    return NextResponse.json(
      { error: 'Você não pode excluir sua própria conta.' },
      { status: 400 }
    )
  }

  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir usuário.' },
      { status: 500 }
    )
  }
}

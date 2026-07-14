import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { canEdit } from '@/lib/permissions'
import type { UserRole } from '@/types/next-auth'

// ⚠️ 'dev' NÃO é atribuível via API — role estrutural (só banco/seed).
const VALID_ROLES: UserRole[] = ['admin', 'operador', 'visualizador']

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !canEdit(session.user.role as UserRole, 'usuarios')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // 🔒 Se um role for informado, precisa ser válido (nunca aceitar 'dev' via API).
    if (body.role !== undefined && !VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Role inválida' }, { status: 400 })
    }

    // 🔒 Blindagem do 'dev': admin não pode rebaixar/alterar um usuário 'dev'.
    // Só outro dev pode mexer num dev (evita admin sabotar a role estrutural).
    if (user.role === 'dev' && session.user.role !== 'dev') {
      return NextResponse.json(
        { error: 'Apenas um desenvolvedor pode alterar outro desenvolvedor' },
        { status: 403 }
      )
    }

    if (body.email && body.email !== user.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: body.email },
      })
      if (emailExists) {
        return NextResponse.json(
          { error: 'Já existe um usuário com este email' },
          { status: 400 }
        )
      }
    }

    // 🔒 Não pode rebaixar a própria conta (admin OU dev) para algo sem gestão.
    if (
      session.user.id === id &&
      body.role &&
      !canEdit(body.role as UserRole, 'usuarios')
    ) {
      return NextResponse.json(
        { error: 'Você não pode remover sua própria permissão de gestão' },
        { status: 400 }
      )
    }

    if (session.user.id === id && body.active === false) {
      return NextResponse.json(
        { error: 'Você não pode desativar sua própria conta' },
        { status: 400 }
      )
    }

    const updateData: {
      name?: string
      email?: string
      role?: string
      active?: boolean
      password?: string
    } = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email
    if (body.role !== undefined) updateData.role = body.role
    if (body.active !== undefined) updateData.active = body.active

    if (body.password && body.password.trim() !== '') {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: 'A senha deve ter no mínimo 6 caracteres' },
          { status: 400 }
        )
      }
      updateData.password = await bcrypt.hash(body.password, 10)
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PUT usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar usuário' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session || !canEdit(session.user.role as UserRole, 'usuarios')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    const { id } = await params

    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'Você não pode excluir sua própria conta' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // 🔒 Blindagem do 'dev': admin não pode excluir um dev.
    if (user.role === 'dev' && session.user.role !== 'dev') {
      return NextResponse.json(
        { error: 'Apenas um desenvolvedor pode excluir outro desenvolvedor' },
        { status: 403 }
      )
    }

    await prisma.user.delete({ where: { id } })

    return NextResponse.json({ message: 'Usuário excluído com sucesso' })
  } catch (error) {
    console.error('Erro DELETE usuário:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir usuário' },
      { status: 500 }
    )
  }
}

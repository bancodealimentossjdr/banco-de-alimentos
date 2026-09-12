import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit, requireAdminOrDev } from '@/lib/auth-helpers'
import { maskDoador } from '@/lib/mask-by-role'
import { podeVerRegistro } from '@/lib/visibilidade'

const NAO_ENCONTRADO = () =>
  NextResponse.json({ error: 'Doador não encontrado' }, { status: 404 })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireView('doadores')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params

    const donor = await prisma.donor.findUnique({
      where: { id },
      include: { _count: { select: { donations: true } } },
    })

    if (!donor) return NAO_ENCONTRADO()
    // 👁️ oculto = inexistente para não-dev
    if (!podeVerRegistro(role, donor)) return NAO_ENCONTRADO()

    const masked = maskDoador(donor, role)
    return NextResponse.json(masked)
  } catch (error) {
    console.error('Erro GET doador:', error)
    return NextResponse.json({ error: 'Erro ao buscar doador' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireEdit('doadores')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params
    const body = await request.json()

    const donor = await prisma.donor.findUnique({ where: { id } })
    if (!donor) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, donor)) return NAO_ENCONTRADO()

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name.length === 0) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const updated = await prisma.donor.update({
      where: { id },
      data: {
        name,
        type: body.type,
        category: body.category,
        contact: body.contact || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
        active: typeof body.active === 'boolean' ? body.active : undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PUT doador:', error)
    return NextResponse.json({ error: 'Erro ao atualizar doador' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireEdit('doadores')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params

    const donor = await prisma.donor.findUnique({
      where: { id },
      include: { _count: { select: { donations: true } } },
    })

    if (!donor) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, donor)) return NAO_ENCONTRADO()

    if (donor._count.donations > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir: este doador possui ${donor._count.donations} doação(ões) vinculada(s).`,
        },
        { status: 400 },
      )
    }

    await prisma.donor.delete({ where: { id } })
    return NextResponse.json({ message: 'Doador excluído com sucesso' })
  } catch (error) {
    console.error('Erro DELETE doador:', error)
    return NextResponse.json({ error: 'Erro ao excluir doador' }, { status: 500 })
  }
}

/**
 * PATCH → alterna apenas o status (ativo/inativo). Admin ou DEV.
 * Não desvincula nada: preserva o histórico de doações.
 *
 * ⚠️ Não confundir com PATCH /[id]/visibilidade — `active` é estado de
 * negócio, `hiddenAt` é limpeza de cadastro (exclusivo do dev).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminOrDev()
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params
    const body = await request.json()

    if (typeof body.active !== 'boolean') {
      return NextResponse.json(
        { error: 'Campo "active" (boolean) é obrigatório' },
        { status: 400 },
      )
    }

    const donor = await prisma.donor.findUnique({ where: { id } })
    if (!donor) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, donor)) return NAO_ENCONTRADO()

    const updated = await prisma.donor.update({
      where: { id },
      data: { active: body.active },
      select: { id: true, name: true, active: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PATCH doador:', error)
    return NextResponse.json({ error: 'Erro ao alterar status' }, { status: 500 })
  }
}

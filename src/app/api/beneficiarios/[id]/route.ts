import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { maskBeneficiario } from '@/lib/mask-by-role'
import { podeVerRegistro } from '@/lib/visibilidade'

const NAO_ENCONTRADO = () =>
  NextResponse.json({ error: 'Instituição não encontrada' }, { status: 404 })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireView('beneficiarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params

    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id },
      include: { _count: { select: { distributions: true } } },
    })

    if (!beneficiary) return NAO_ENCONTRADO()
    // 👁️ oculto = inexistente para não-dev
    if (!podeVerRegistro(role, beneficiary)) return NAO_ENCONTRADO()

    const masked = maskBeneficiario(beneficiary, role)
    return NextResponse.json(masked)
  } catch (error) {
    console.error('Erro GET beneficiário:', error)
    return NextResponse.json({ error: 'Erro ao buscar instituição' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireEdit('beneficiarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params
    const body = await request.json()

    const beneficiary = await prisma.beneficiary.findUnique({ where: { id } })
    if (!beneficiary) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, beneficiary)) return NAO_ENCONTRADO()

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name.length === 0) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const updated = await prisma.beneficiary.update({
      where: { id },
      data: {
        name,
        type: body.type,
        address: body.address || null,
        phone: body.phone || null,
        contact: body.contact || null,
        status: body.status || 'ativo',
        notes: body.notes || null,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Erro PUT beneficiário:', error)
    return NextResponse.json({ error: 'Erro ao atualizar instituição' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireEdit('beneficiarios')
  if (authResult instanceof NextResponse) return authResult

  const role = authResult.user.role

  try {
    const { id } = await params

    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id },
      include: { _count: { select: { distributions: true } } },
    })

    if (!beneficiary) return NAO_ENCONTRADO()
    if (!podeVerRegistro(role, beneficiary)) return NAO_ENCONTRADO()

    if (beneficiary._count.distributions > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir: esta instituição possui ${beneficiary._count.distributions} distribuição(ões) vinculada(s).`,
        },
        { status: 400 },
      )
    }

    await prisma.beneficiary.delete({ where: { id } })
    return NextResponse.json({ message: 'Instituição excluída com sucesso' })
  } catch (error) {
    console.error('Erro DELETE beneficiário:', error)
    return NextResponse.json({ error: 'Erro ao excluir instituição' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { auth } from '@/lib/auth'
import { maskDoador } from '@/lib/mask-by-role'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireView('doadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const session = await auth()
    const role = session?.user?.role

    const donor = await prisma.donor.findUnique({
      where: { id },
      include: {
        _count: { select: { donations: true } },
      },
    })

    if (!donor) {
      return NextResponse.json({ error: 'Doador não encontrado' }, { status: 404 })
    }

    const masked = maskDoador(donor, role)
    return NextResponse.json(masked)
  } catch (error) {
    console.error('Erro GET doador:', error)
    return NextResponse.json({ error: 'Erro ao buscar doador' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('doadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params
    const body = await request.json()

    const donor = await prisma.donor.findUnique({ where: { id } })
    if (!donor) {
      return NextResponse.json({ error: 'Doador não encontrado' }, { status: 404 })
    }

    const updated = await prisma.donor.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        category: body.category,
        contact: body.contact || null,
        phone: body.phone || null,
        email: body.email || null,
        address: body.address || null,
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
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireEdit('doadores')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const donor = await prisma.donor.findUnique({
      where: { id },
      include: { _count: { select: { donations: true } } },
    })

    if (!donor) {
      return NextResponse.json({ error: 'Doador não encontrado' }, { status: 404 })
    }

    if (donor._count.donations > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir: este doador possui ${donor._count.donations} doação(ões) vinculada(s).`,
        },
        { status: 400 }
      )
    }

    await prisma.donor.delete({ where: { id } })
    return NextResponse.json({ message: 'Doador excluído com sucesso' })
  } catch (error) {
    console.error('Erro DELETE doador:', error)
    return NextResponse.json({ error: 'Erro ao excluir doador' }, { status: 500 })
  }
}

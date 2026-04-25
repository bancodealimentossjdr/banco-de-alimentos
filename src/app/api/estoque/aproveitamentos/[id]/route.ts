import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  requireView,
  requireEditRecord,
  requireAdmin,
} from '@/lib/auth-helpers'
import { z } from 'zod'
import { startOfDay, endOfDay } from 'date-fns'

const updateSchema = z.object({
  approvedQty: z.number().min(0).optional(),
  notes: z.string().optional().nullable(),
})

// 🔍 GET — detalhe de um aproveitamento
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireView('estoque')
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const approval = await prisma.dailyApproval.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    })

    if (!approval) {
      return NextResponse.json(
        { error: 'Aproveitamento não encontrado' },
        { status: 404 },
      )
    }

    return NextResponse.json(approval)
  } catch (error) {
    console.error('[APROVEITAMENTO_GET]', error)
    return NextResponse.json(
      { error: 'Erro ao buscar aproveitamento' },
      { status: 500 },
    )
  }
}

// ✏️ PATCH — atualizar (respeita trava temporal do operador)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const approval = await prisma.dailyApproval.findUnique({
      where: { id },
    })

    if (!approval) {
      return NextResponse.json(
        { error: 'Aproveitamento não encontrado' },
        { status: 404 },
      )
    }

    // 🛡️ requireEditRecord respeita a trava temporal de operador
    const authResult = await requireEditRecord('estoque', approval.createdAt)
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json()
    const data = updateSchema.parse(body)

    // 🧮 Se está atualizando approvedQty, validar limite
    if (data.approvedQty !== undefined) {
      const dayStart = startOfDay(approval.date)
      const dayEnd = endOfDay(approval.date)

      const donationItems = await prisma.donationItem.findMany({
        where: {
          donation: {
            date: { gte: dayStart, lte: dayEnd },
          },
        },
        select: { quantity: true },
      })

      const totalReceived = donationItems.reduce((s, i) => s + i.quantity, 0)

      if (data.approvedQty > totalReceived) {
        return NextResponse.json(
          {
            error: `Aproveitado (${data.approvedQty} kg) não pode ser maior que o recebido (${totalReceived} kg)`,
          },
          { status: 400 },
        )
      }
    }

    const updated = await prisma.dailyApproval.update({
      where: { id },
      data: {
        ...data,
        updatedById: authResult.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.issues },
        { status: 400 },
      )
    }
    console.error('[APROVEITAMENTO_PATCH]', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar aproveitamento' },
      { status: 500 },
    )
  }
}

// 🗑️ DELETE — só admin pode excluir
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdmin()
  if (authResult instanceof NextResponse) return authResult

  try {
    const { id } = await params

    const exists = await prisma.dailyApproval.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!exists) {
      return NextResponse.json(
        { error: 'Aproveitamento não encontrado' },
        { status: 404 },
      )
    }

    await prisma.dailyApproval.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[APROVEITAMENTO_DELETE]', error)
    return NextResponse.json(
      { error: 'Erro ao excluir aproveitamento' },
      { status: 500 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireToggleVisibility } from '@/lib/auth-helpers'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireToggleVisibility()
  if (guard instanceof NextResponse) return guard

  const { id } = await params

  try {
    const body = await req.json()
    const ocultar = Boolean(body?.ocultar)
    const nota = typeof body?.nota === 'string' ? body.nota.trim() : null

    if (ocultar && (!nota || nota.length < 5)) {
      return NextResponse.json(
        { error: 'Informe um motivo com pelo menos 5 caracteres.' },
        { status: 400 },
      )
    }

    const alvo = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!alvo) {
      return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 })
    }

    const atualizado = await prisma.employee.update({
      where: { id },
      data: ocultar
        ? {
            hiddenAt: new Date(),
            hiddenById: guard.user.id,
            hiddenNota: nota,
          }
        : {
            hiddenAt: null,
            hiddenById: null,
            hiddenNota: null,
          },
      select: { id: true, hiddenAt: true, hiddenNota: true },
    })

    return NextResponse.json(atualizado)
  } catch (error) {
    console.error('Erro ao alterar visibilidade do funcionário:', error)
    return NextResponse.json({ error: 'Erro ao alterar visibilidade' }, { status: 500 })
  }
}

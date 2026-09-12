import { NextRequest, NextResponse } from 'next/server'
import { requireToggleVisibility } from '@/lib/auth-helpers'
import { toggleVisibilidade } from '@/lib/visibilidade'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireToggleVisibility()
  if (authResult instanceof NextResponse) return authResult

  const { id } = await params

  try {
    const body = await request.json().catch(() => ({}))
    const ocultar = Boolean(body.ocultar)
    const nota =
      typeof body.nota === 'string' && body.nota.trim() ? body.nota.trim() : null

    if (ocultar && (!nota || nota.length < 5)) {
      return NextResponse.json(
        { error: 'Informe um motivo com pelo menos 5 caracteres para ocultar.' },
        { status: 400 },
      )
    }

    const registro = await toggleVisibilidade({
      cadastro: 'doadores',
      id,
      ocultar,
      nota,
      userId: authResult.user.id,
    })

    return NextResponse.json(registro)
  } catch (error) {
    console.error('Erro ao alterar visibilidade do doador:', error)
    return NextResponse.json({ error: 'Erro ao alterar visibilidade' }, { status: 500 })
  }
}

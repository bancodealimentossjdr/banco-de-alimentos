import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireView } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

// ============================================
// GET /api/distribuicoes/[id]/comprovante
// Retorna o comprovante de entrega (assinatura + auditoria)
// junto dos dados da distribuição, para visualização e PDF.
//
// Regras (validadas no servidor):
//   1. Auth: precisa VER o módulo distribuicoes      → senão 401/403
//   2. 🚫 Visualizador NÃO acessa comprovante         → 403 (regra do schema)
//   3. Distribuição precisa existir                   → 404
//   4. Precisa ter sido finalizada (ter receipt)      → 404
//   5. Resposta 200 { distribution + receipt }
// ============================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 🛡️ Regra 1: precisa ter acesso de visualização ao módulo
  const authResult = await requireView('distribuicoes')
  if (authResult instanceof NextResponse) return authResult
  const auth = authResult

  // 🛡️ Regra 2: comprovante é OCULTO para visualizador (decisão de schema)
  if (auth.user.role === 'visualizador') {
    return NextResponse.json(
      { error: 'Seu perfil não tem acesso ao comprovante de entrega.' },
      { status: 403 },
    )
  }

  try {
    const { id } = await params

    // 🛡️ Regra 3: distribuição precisa existir
    const distribution = await prisma.distribution.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { id: true, name: true, address: true } },
        items: {
          include: {
            product: { select: { name: true, unit: true } },
          },
        },
        receipt: {
          include: {
            finalizedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    if (!distribution) {
      return NextResponse.json(
        { error: 'Distribuição não encontrada' },
        { status: 404 },
      )
    }

    // 🛡️ Regra 4: precisa ter comprovante (estar finalizada)
    if (!distribution.receipt) {
      return NextResponse.json(
        {
          error:
            'Esta distribuição ainda não foi finalizada — não há comprovante.',
        },
        { status: 404 },
      )
    }

    // ✅ Serialização explícita (não vaza nada além do necessário)
    return NextResponse.json(
      {
        distribution: {
          id: distribution.id,
          date: distribution.date,
          status: distribution.status,
          notes: distribution.notes,
          beneficiary: distribution.beneficiary,
          items: distribution.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            boxes: item.boxes,
            product: {
              name: item.product.name,
              unit: item.product.unit,
            },
          })),
        },
        receipt: {
          id: distribution.receipt.id,
          recipientName: distribution.receipt.recipientName,
          signatureData: distribution.receipt.signatureData,
          notes: distribution.receipt.notes,
          finalizedAt: distribution.receipt.finalizedAt,
          finalizedBy: distribution.receipt.finalizedBy,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error('[GET /api/distribuicoes/[id]/comprovante] erro:', error)
    return NextResponse.json(
      { error: 'Erro ao carregar comprovante' },
      { status: 500 },
    )
  }
}

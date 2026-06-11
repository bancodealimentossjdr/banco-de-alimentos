import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireEdit } from '@/lib/auth-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// ============================================
// POST /api/distribuicoes/[id]/finalizar
// Finaliza uma distribuição PENDENTE — operador ou admin.
//
// Regras (validadas no servidor):
//   1. Distribuição precisa existir            → senão 404
//   2. Não pode ser legado (legacy)            → 409
//   3. Não pode já estar ENTREGUE              → 409
//   4. Body validado com Zod                   → senão 400
//   5. Transação atômica:
//        - cria DeliveryReceipt (finalizedById = auth.user.id)
//        - muda Distribution.status → ENTREGUE
//   6. Resposta 201 { distribution + receipt }
//
// Nota: NÃO usa trava temporal (requireEditRecord) de propósito —
// operador pode finalizar uma entrega no dia seguinte ao da criação.
// A edição dos números continua protegida nas rotas de edição.
// ============================================
const FinalizeSchema = z.object({
  recipientName: z
    .string({ error: 'Nome do recebedor é obrigatório' })
    .trim()
    .min(2, 'Nome do recebedor deve ter ao menos 2 caracteres')
    .max(200, 'Nome do recebedor muito longo'),
  // 🔄 renomeado: signatureSvg → signatureData (PNG base64 / data URL)
  signatureData: z
    .string({ error: 'Assinatura é obrigatória' })
    .trim()
    .min(1, 'Assinatura é obrigatória'),
  notes: z.string().max(1000).optional().nullable(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 🛡️ Auth: operador ou admin (validado no servidor)
  const authResult = await requireEdit('distribuicoes')
  if (authResult instanceof NextResponse) return authResult
  const auth = authResult

  try {
    const { id } = await params

    // Valida body com Zod
    const body = await req.json()
    const parsed = FinalizeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { recipientName, signatureData, notes } = parsed.data

    // 🛡️ Regra 1: distribuição precisa existir
    const distribution = await prisma.distribution.findUnique({
      where: { id },
      include: { receipt: true }, // ✅ nome correto da relação 1:1
    })

    if (!distribution) {
      return NextResponse.json(
        { error: 'Distribuição não encontrada' },
        { status: 404 },
      )
    }

    // 🛡️ Regra 2: legado não pode ser finalizado
    if (distribution.legacy) {
      return NextResponse.json(
        {
          error:
            'Distribuições legadas (importadas) já estão concluídas e não podem ser finalizadas.',
        },
        { status: 409 },
      )
    }

    // 🛡️ Regra 3: não refinalizar
    if (distribution.status === 'ENTREGUE' || distribution.receipt) {
      return NextResponse.json(
        { error: 'Esta distribuição já foi finalizada.' },
        { status: 409 },
      )
    }

    // ✅ Transação atômica: ou cria comprovante E muda status, ou nada acontece
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.deliveryReceipt.create({
        data: {
          distributionId: id,
          recipientName,
          signatureData, // 🔄 renomeado
          notes: notes ?? null,
          finalizedById: auth.user.id,
        },
        include: {
          finalizedBy: { select: { id: true, name: true, email: true } },
        },
      })

      const updated = await tx.distribution.update({
        where: { id },
        data: { status: 'ENTREGUE' },
      })

      return { distribution: updated, receipt }
    })

    return NextResponse.json(
      {
        distribution: {
          id: result.distribution.id,
          status: result.distribution.status,
        },
        receipt: {
          id: result.receipt.id,
          recipientName: result.receipt.recipientName,
          notes: result.receipt.notes,
          finalizedAt: result.receipt.finalizedAt,
          finalizedBy: result.receipt.finalizedBy,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[POST /api/distribuicoes/[id]/finalizar] erro:', error)
    return NextResponse.json(
      { error: 'Erro ao finalizar distribuição' },
      { status: 500 },
    )
  }
}
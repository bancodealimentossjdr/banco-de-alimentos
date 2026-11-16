import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdminOrDev } from '@/lib/auth-helpers'
import { atualizarTermoAdminSchema } from '@/lib/validations/termo-paa'
import {
  calcularLinhasTermo,
  civilParaDate,
  serializeTermo,
  serializeLinhas,
  maskTermo,
} from '@/lib/paa/termo'

export const dynamic = 'force-dynamic'

const selectDetalhe = {
  id: true,
  numeroTermo: true,
  dataTermo: true,
  valorTotal: true,
  quantidadeTotal: true,
  pesoTotalKg: true,
  notaFiscal: true,
  dataAteste: true,
  observacaoInterna: true,
  registradoEm: true,
  updatedAt: true,
  producer: { select: { id: true, name: true, cpf: true, dapCaf: true } },
  registradoPor: { select: { id: true, name: true } },
  entregas: {
    orderBy: { dataEntrega: 'asc' as const },
    select: {
      id: true,
      dataEntrega: true,
      status: true,
      valorTotal: true,
      pesoTotalKg: true,
      assinaturaEm: true,
      itens: {
        select: {
          productId: true,
          tipoCultivo: true,
          quantidade: true,
          precoUnitario: true,
          fatorKg: true,
          pesoKg: true,
          subtotal: true,
          product: {
            select: { name: true, codigoConab: true, codigoConabOrganico: true, paaUnidade: true },
          },
        },
      },
    },
  },
} satisfies Prisma.TermoPaaSelect

// ---------- GET: detalhe + linhas SISPAA ----------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminOrDev()
  if (authResult instanceof NextResponse) return authResult
  const role = authResult.user.role

  try {
    const { id } = await params
    const t = await prisma.termoPaa.findUnique({ where: { id }, select: selectDetalhe })
    if (!t) return NextResponse.json({ error: 'Termo não encontrado' }, { status: 404 })

    const calc = calcularLinhasTermo(t.entregas.flatMap((e) => e.itens))
    const linhas = 'error' in calc ? [] : serializeLinhas(calc.linhas)
    const aviso =
      t.entregas.length === 0
        ? 'Termo sem entregas. Reemitir no SISPAA (o número não se reutiliza).'
        : 'error' in calc
          ? calc.error
          : null

    return NextResponse.json(maskTermo({ ...serializeTermo(t), linhas, aviso }, role))
  } catch (error) {
    console.error('[GET /api/paa/termos/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro ao carregar Termo' }, { status: 500 })
  }
}

// ---------- PATCH: NF, ateste, observação interna (admin/dev) ----------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminOrDev()
  if (authResult instanceof NextResponse) return authResult
  const role = authResult.user.role

  const body = await req.json().catch(() => null)
  const parsed = atualizarTermoAdminSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  const data: Prisma.TermoPaaUpdateInput = {}
  if (parsed.data.notaFiscal !== undefined) data.notaFiscal = parsed.data.notaFiscal
  if (parsed.data.observacaoInterna !== undefined) data.observacaoInterna = parsed.data.observacaoInterna
  if (parsed.data.dataAteste !== undefined) {
    data.dataAteste = parsed.data.dataAteste ? civilParaDate(parsed.data.dataAteste) : null
  }
  if (!Object.keys(data).length) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  }

  try {
    const { id } = await params
    const t = await prisma.termoPaa.update({ where: { id }, data, select: selectDetalhe })
    const calc = calcularLinhasTermo(t.entregas.flatMap((e) => e.itens))
    const linhas = 'error' in calc ? [] : serializeLinhas(calc.linhas)
    return NextResponse.json(maskTermo({ ...serializeTermo(t), linhas }, role))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Termo não encontrado' }, { status: 404 })
    }
    console.error('[PATCH /api/paa/termos/[id]] erro:', error)
    return NextResponse.json({ error: 'Erro ao atualizar Termo' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireView, requireEdit } from '@/lib/auth-helpers'
import { criarTermoSchema } from '@/lib/validations/termo-paa'
import {
  HttpError,
  calcularLinhasTermo,
  civilParaDate,
  dateParaCivil,
  civilParaBR,
  serializeTermo,
  maskTermo,
} from '@/lib/paa/termo'

export const dynamic = 'force-dynamic'

// ---------- GET: lista de Termos (?producerId=) ----------
export async function GET(req: NextRequest) {
  const authResult = await requireView('paa')
  if (authResult instanceof NextResponse) return authResult
  const role = authResult.user.role

  const producerId = req.nextUrl.searchParams.get('producerId') || undefined

  try {
    const termos = await prisma.termoPaa.findMany({
      where: producerId ? { producerId } : undefined,
      orderBy: [{ dataTermo: 'desc' }, { registradoEm: 'desc' }],
      take: 200,
      select: {
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
        producer: { select: { id: true, name: true } },
        registradoPor: { select: { id: true, name: true } },
        _count: { select: { entregas: true } },
      },
    })
    return NextResponse.json(termos.map((t) => maskTermo(serializeTermo(t), role)))
  } catch (error) {
    console.error('[GET /api/paa/termos] erro:', error)
    return NextResponse.json({ error: 'Erro ao listar Termos' }, { status: 500 })
  }
}

// ---------- POST: cria Termo com 1..100 entregas ASSINADAS do mesmo produtor ----------
export async function POST(req: NextRequest) {
  const authResult = await requireEdit('paa')
  if (authResult instanceof NextResponse) return authResult
  const auth = authResult

  const body = await req.json().catch(() => null)
  const parsed = criarTermoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }
  const { numeroTermo, dataTermo, producerId, entregaIds } = parsed.data

  try {
    const termo = await prisma.$transaction(async (tx) => {
      const entregas = await tx.entregaPaa.findMany({
        where: { id: { in: entregaIds } },
        select: {
          id: true,
          producerId: true,
          status: true,
          termoPaaId: true,
          dataEntrega: true,
          itens: {
            select: {
              productId: true,
              tipoCultivo: true,
              quantidade: true,
              precoUnitario: true,
              pesoKg: true,
              product: { select: { name: true } },
            },
          },
        },
      })

      if (entregas.length !== entregaIds.length) {
        throw new HttpError(404, 'Uma ou mais entregas não foram encontradas.')
      }

      const outroProdutor = entregas.filter((e) => e.producerId !== producerId)
      if (outroProdutor.length) {
        throw new HttpError(400, 'Todas as entregas precisam ser do mesmo produtor do Termo.')
      }

      const indisponiveis = entregas.filter((e) => e.status !== 'ASSINADA' || e.termoPaaId !== null)
      if (indisponiveis.length) {
        const datas = indisponiveis
          .map((e) => civilParaBR(dateParaCivil(e.dataEntrega)!))
          .join(', ')
        throw new HttpError(
          409,
          `Entregas não disponíveis (sem assinatura ou já em outro Termo): ${datas}. Recarregue a lista.`,
        )
      }

      // Decisão a: dataTermo não pode ser anterior à entrega mais recente
      const maisRecente = entregas.map((e) => dateParaCivil(e.dataEntrega)!).sort().at(-1)!
      if (dataTermo < maisRecente) {
        throw new HttpError(
          400,
          `A data do Termo não pode ser anterior à entrega mais recente (${civilParaBR(maisRecente)}).`,
        )
      }

      const calc = calcularLinhasTermo(entregas.flatMap((e) => e.itens))
      if ('error' in calc) throw new HttpError(400, calc.error)
      if (calc.valorTotal.lte(0)) throw new HttpError(400, 'Termo com valor zero não pode ser criado.')

      const criado = await tx.termoPaa.create({
        data: {
          numeroTermo,
          dataTermo: civilParaDate(dataTermo),
          producerId,
          valorTotal: calc.valorTotal,
          quantidadeTotal: calc.quantidadeTotal,
          pesoTotalKg: calc.pesoTotalKg,
          registradoPorId: auth.user.id,
        },
        select: { id: true },
      })

      // 🛡️ Anti-corrida: só vincula se continuam ASSINADAS e livres
      const upd = await tx.entregaPaa.updateMany({
        where: { id: { in: entregaIds }, producerId, status: 'ASSINADA', termoPaaId: null },
        data: { status: 'FINALIZADA', termoPaaId: criado.id },
      })
      if (upd.count !== entregaIds.length) {
        throw new HttpError(409, 'Alguma entrega foi alterada durante a criação do Termo. Recarregue e tente de novo.')
      }

      return tx.termoPaa.findUniqueOrThrow({
        where: { id: criado.id },
        select: {
          id: true,
          numeroTermo: true,
          dataTermo: true,
          valorTotal: true,
          quantidadeTotal: true,
          pesoTotalKg: true,
          registradoEm: true,
          producer: { select: { id: true, name: true } },
          _count: { select: { entregas: true } },
        },
      })
    })

    return NextResponse.json(maskTermo(serializeTermo(termo), auth.user.role), { status: 201 })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: `O Termo ${numeroTermo} já está registrado. Número do SISPAA não se repete.` },
        { status: 409 },
      )
    }
    console.error('[POST /api/paa/termos] erro:', error)
    return NextResponse.json({ error: 'Erro ao criar Termo' }, { status: 500 })
  }
}

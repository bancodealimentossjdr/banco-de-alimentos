// src/app/api/paa/cota/reset/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getCotaProdutor, getCotasTodos } from '@/lib/paa/cota'

/**
 * ♻️ POST /api/paa/cota/reset
 * Body: { producerId?: string | null, motivo: string }
 *   producerId ausente/null → reset GLOBAL (todos).
 *
 * 🛡️ Restrito a admin e dev. Backend nunca confia no frontend:
 *    a role é lida da sessão, jamais do body.
 *
 * ⚠️ NÃO apaga entregas. Grava um marco datado; o acumulado passa a
 *    contar de resetAt em diante. Histórico e auditoria preservados.
 */

const ROLES_PERMITIDAS = ['admin', 'dev']

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = session?.user?.role

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }
  if (!role || !ROLES_PERMITIDAS.includes(role)) {
    return NextResponse.json(
      { error: 'Apenas administradores podem resetar cotas.' },
      { status: 403 },
    )
  }

  let body: { producerId?: string | null; motivo?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 })
  }

  const motivo = (body.motivo ?? '').trim()
  if (motivo.length < 5) {
    return NextResponse.json(
      { error: 'Informe um motivo com pelo menos 5 caracteres.' },
      { status: 400 },
    )
  }

  const producerId = body.producerId ?? null

  try {
    if (producerId) {
      const existe = await prisma.producer.findUnique({
        where: { id: producerId },
        select: { id: true, name: true },
      })
      if (!existe) {
        return NextResponse.json(
          { error: 'Produtor não encontrado.' },
          { status: 404 },
        )
      }

      // 📸 Snapshot ANTES do marco — prova do valor zerado.
      const antes = await getCotaProdutor(producerId)

      const marco = await prisma.paaCotaReset.create({
        data: {
          producerId,
          motivo,
          valorZerado: antes.usado,
          createdById: session.user.id,
        },
      })

      return NextResponse.json({
        ok: true,
        escopo: 'produtor',
        produtor: existe.name,
        valorZerado: antes.usado,
        resetAt: marco.resetAt,
      })
    }

    // 🌐 Reset global — snapshot somado de todos.
    const todos = await getCotasTodos()
    const totalZerado =
      Math.round(todos.reduce((a, c) => a + c.usado, 0) * 100) / 100

    const marco = await prisma.paaCotaReset.create({
      data: {
        producerId: null,
        motivo,
        valorZerado: totalZerado,
        createdById: session.user.id,
      },
    })

    return NextResponse.json({
      ok: true,
      escopo: 'global',
      produtoresAfetados: todos.filter((c) => c.usado > 0).length,
      valorZerado: totalZerado,
      resetAt: marco.resetAt,
    })
  } catch (error) {
    console.error('[paa/cota/reset] Erro:', error)
    return NextResponse.json(
      { error: 'Erro ao registrar reset de cota.' },
      { status: 500 },
    )
  }
}

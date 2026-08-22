// src/lib/eventos/vinculo.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-helpers'
import { podeRegistrarNoEvento } from '@/lib/permissions'
import type { UserRole } from '@/types/next-auth'

/**
 * 🧹 ONDA 22 (22-d) — DT-1.
 *
 * Extrai a lógica de autorização por evento, que estava duplicada em
 * 5 handlers (recebimentos POST/GET, arrecadacao-extra, folha-resumo POST/GET).
 *
 * O bloco repetido era:
 *   1. sessão válida
 *   2. evento existe
 *   3. evento está ATIVO
 *   4. se role = visualizador → checar EventoOperador.ativo
 *   5. podeRegistrarNoEvento(role, temVinculoAtivo)
 *
 * A duplicação escondia divergências reais de status HTTP:
 *   - arrecadacao-extra devolvia 403 para evento inativo
 *   - recebimentos e folha-resumo devolviam 409
 * → padronizado em 409 (conflito de estado do recurso).
 */

export type ContextoEvento = {
  userId: string
  role: UserRole
  /** true quando o vínculo EventoOperador existe e está ativo */
  temVinculoAtivo: boolean
  /** status do evento no momento da checagem */
  statusEvento: string
  /** 🔒 privilégios derivados — decididos no SERVIDOR */
  isDev: boolean
  podeEditar: boolean
  podeExportar: boolean
  revelarCpf: boolean
}

type Opcoes = {
  /**
   * Exige `status === 'ATIVO'`.
   * true  → escrita (registrar doação, ingresso, arrecadação)
   * false → leitura histórica (consultar evento encerrado)
   */
  exigirAtivo?: boolean
}

/**
 * Autoriza a operação no evento.
 * Retorna `NextResponse` em qualquer falha — o handler só faz:
 *
 *   const ctx = await autorizarEvento(eventoId, { exigirAtivo: true })
 *   if (ctx instanceof NextResponse) return ctx
 */
export async function autorizarEvento(
  eventoId: string,
  { exigirAtivo = true }: Opcoes = {},
): Promise<ContextoEvento | NextResponse> {
  // 1️⃣ sessão — propaga a Response original (não achata tudo em 401)
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  const userId = result.user.id
  const role = result.user.role

  // 2️⃣ evento existe
  const evento = await prisma.evento.findUnique({
    where: { id: eventoId },
    select: { id: true, status: true },
  })
  if (!evento) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }

  // 3️⃣ evento ATIVO (quando exigido)
  if (exigirAtivo && evento.status !== 'ATIVO') {
    return NextResponse.json(
      { error: 'Esta ação só é permitida em eventos ATIVOS' },
      { status: 409 },
    )
  }

  // 4️⃣ vínculo — só o visualizador depende dele
  let temVinculoAtivo = false
  if (role === 'visualizador') {
    const vinculo = await prisma.eventoOperador.findUnique({
      where: { eventoId_userId: { eventoId, userId } },
      select: { ativo: true },
    })
    temVinculoAtivo = vinculo?.ativo === true
  }

  // 5️⃣ gate final
  if (!podeRegistrarNoEvento(role, temVinculoAtivo)) {
    return NextResponse.json(
      { error: 'Você não tem permissão para operar neste evento' },
      { status: 403 },
    )
  }

  const isDev = role === 'dev'

  return {
    userId,
    role,
    temVinculoAtivo,
    statusEvento: evento.status,
    isDev,
    podeEditar: isDev,
    // 🆕 ONDA 21.6 — export liberado p/ dev e admin
    podeExportar: isDev || role === 'admin',
    // 🎭 CPF cru SOMENTE para dev — decidido no servidor
    revelarCpf: isDev,
  }
}

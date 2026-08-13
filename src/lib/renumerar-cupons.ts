// src/lib/renumerar-cupons.ts
import { prisma } from '@/lib/prisma'

/**
 * Tipo do client transacional derivado do próprio prisma.
 * Evita depender do namespace `Prisma` (que não é exportado
 * quando o generator usa `output` customizado).
 */
export type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

/**
 * Recomputa as faixas de cupons de um show inteiro em ordem cronológica,
 * eliminando buracos, e realinha o ShowContador.
 *
 * ⚠️ SÓ pode ser chamado enquanto os cupons NÃO foram divulgados.
 */
export async function renumerarShow(
  tx: TxClient,
  eventoId: string,
  showDia: string,
): Promise<number> {
  await tx.$executeRaw`
    WITH ord AS (
      SELECT i.id,
             SUM(i.quantidade) OVER (
               ORDER BY a."createdAt", i.id
               ROWS UNBOUNDED PRECEDING
             ) AS fim,
             i.quantidade
      FROM "ArrecadacaoItem" i
      JOIN "ArrecadacaoExtra" a ON a.id = i."arrecadacaoId"
      WHERE a."eventoId" = ${eventoId} AND i."showDia" = ${showDia}
    )
    UPDATE "ArrecadacaoItem" t
    SET "numeroInicio" = o.fim - o.quantidade + 1,
        "numeroFim"    = o.fim
    FROM ord o
    WHERE t.id = o.id
  `

  const agg = await tx.arrecadacaoItem.aggregate({
    where: { showDia, arrecadacao: { eventoId } },
    _sum: { quantidade: true },
  })
  const total: number = agg._sum.quantidade ?? 0

  await tx.showContador.upsert({
    where: { eventoId_showDia: { eventoId, showDia } },
    create: { eventoId, showDia, ultimoNumero: total },
    update: { ultimoNumero: total },
  })

  return total
}

/** Shows congelados (já divulgados) — nunca renumerar. */
export const SHOWS_CONGELADOS: ReadonlySet<string> = new Set<string>([
  'hugo-guilherme-13',
  'ana-castela-14',
  'daniel-15',
  'mariana-fagundes-16',
])

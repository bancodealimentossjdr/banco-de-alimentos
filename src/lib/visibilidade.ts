import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/types/next-auth'
import { canSeeHidden } from '@/lib/permissions'

/**
 * 🆕 ONDA 23.7e-3 — Soft-hide de cadastros.
 *
 * Producer, Employee, Donor e Beneficiary ganharam:
 *   hiddenAt DateTime? · hiddenById String? · hiddenNota String?
 *
 * Semântica:
 *   - hiddenAt NULL → visível para TODOS (estado normal, default)
 *   - hiddenAt SET  → sai das listagens; só o dev vê, e só se pedir
 *
 * ⚠️ hiddenAt ≠ active. `active` é estado de negócio (admin controla, o
 * registro continua listado). `hiddenAt` é limpeza de cadastro: tira da
 * vista sem apagar histórico. Exclusivo do dev.
 *
 * ⚠️ Requer os 3 campos no schema.prisma + `prisma generate`. Sem isso o
 * Client não reconhece `hiddenAt` e a query estoura com
 * PrismaClientValidationError.
 */

/** Cadastros que suportam soft-hide. Chave = segmento da rota. */
export const CADASTROS_OCULTAVEIS = {
  produtores: 'producer',
  funcionarios: 'employee',
  doadores: 'donor',
  beneficiarios: 'beneficiary',
} as const

export type CadastroOcultavel = keyof typeof CADASTROS_OCULTAVEIS

export function isCadastroOcultavel(v: string): v is CadastroOcultavel {
  return Object.prototype.hasOwnProperty.call(CADASTROS_OCULTAVEIS, v)
}

/**
 * 🛡️ Filtro de visibilidade para o `where` do Prisma.
 *
 * Fail-secure: qualquer role diferente de dev SEMPRE recebe
 * `hiddenAt: null`, ignorando o que o cliente mandar na querystring.
 * O `?ocultos=true` só tem efeito para o dev.
 *
 * @returns `{ hiddenAt: null }` (esconde ocultos) ou `{}` (mostra tudo)
 */
export function filtroVisibilidade(
  role: UserRole | undefined,
  incluirOcultos: boolean,
): { hiddenAt?: null } {
  if (!role) return { hiddenAt: null }
  if (incluirOcultos && canSeeHidden(role)) return {}
  return { hiddenAt: null }
}

/** Lê o parâmetro `?ocultos=true`. */
export function pediuOcultos(searchParams: URLSearchParams): boolean {
  return searchParams.get('ocultos') === 'true'
}

type ToggleArgs = {
  cadastro: CadastroOcultavel
  id: string
  ocultar: boolean
  nota: string | null
  userId: string
}

/**
 * ♻️ Alterna a visibilidade de um registro.
 * O gate de permissão (requireToggleVisibility) fica NA ROTA, antes daqui.
 *
 * Nunca apaga nada: ocultar só grava o marco; reexibir limpa os 3 campos.
 */
export async function toggleVisibilidade({
  cadastro,
  id,
  ocultar,
  nota,
  userId,
}: ToggleArgs) {
  const model = CADASTROS_OCULTAVEIS[cadastro]

  const data = ocultar
    ? { hiddenAt: new Date(), hiddenById: userId, hiddenNota: nota }
    : { hiddenAt: null, hiddenById: null, hiddenNota: null }

  // delegate dinâmico — os 4 models têm exatamente os mesmos 3 campos
  const delegate = (prisma as any)[model]
  if (!delegate?.update) {
    throw new Error(
      `Model "${model}" não encontrado no Prisma Client. Rode: npx prisma generate`,
    )
  }

  return delegate.update({
    where: { id },
    data,
    select: { id: true, name: true, hiddenAt: true, hiddenNota: true },
  })
}

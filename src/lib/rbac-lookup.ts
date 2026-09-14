import type { UserRole } from '@/types/next-auth'
import { canView, canEdit } from '@/lib/permissions'

/**
 * 🆕 ONDA 23.7e-4 — Gate de LOOKUP de cadastros.
 *
 * Problema que resolve: para preencher o <select> de um formulário de
 * lançamento, a role precisa apenas de `{ id, name }`. Exigir
 * canView('funcionarios') para isso acopla o formulário à permissão de
 * GERIR o cadastro — e liberar canView abriria CPF, salário e endereço.
 *
 * Solução: quem pode LANÇAR em um módulo pode LISTAR os cadastros que
 * aquele lançamento referencia, com payload mínimo e select fechado.
 *
 * ⚠️ O gate é frouxo POR DESENHO. Ele só é seguro porque o `select` do
 * ramo lookup é literal (`{ id: true, name: true }`). Nunca use `include`,
 * nunca faça spread do registro nesse ramo.
 */
export type EntidadeLookup =
  | 'funcionarios'
  | 'doadores'
  | 'beneficiarios'
  | 'produtores'

export function canLookup(role: UserRole | undefined, entidade: EntidadeLookup): boolean {
  if (!role) return false

  switch (entidade) {
    // Funcionário aparece em doação, distribuição, colheita e evento.
    case 'funcionarios':
      return (
        canEdit(role, 'doacoes') ||
        canEdit(role, 'distribuicoes') ||
        canEdit(role, 'colheita-solidaria') ||
        canEdit(role, 'eventos') ||
        canView(role, 'funcionarios')
      )

    case 'doadores':
      return canEdit(role, 'doacoes') || canView(role, 'doadores')

    case 'beneficiarios':
      return canEdit(role, 'distribuicoes') || canView(role, 'beneficiarios')

    case 'produtores':
      return (
        canEdit(role, 'paa') ||
        canEdit(role, 'colheita-solidaria') ||
        canView(role, 'produtores')
      )

    // 🛡️ Fail-secure: entidade desconhecida nunca é liberada.
    default:
      return false
  }
}

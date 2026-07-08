import type { UserRole } from '@/types/next-auth'

/**
 * Módulos do sistema.
 * Use estas chaves ao verificar permissões em páginas e APIs.
 */
export type Module =
  | 'dashboard'
  | 'produtos'
  | 'doadores'
  | 'beneficiarios'
  | 'funcionarios'
  | 'produtores'
  | 'doacoes'
  | 'distribuicoes'
  | 'colheita-solidaria'
  | 'estoque'
  | 'usuarios'
  | 'indicadores'
  | 'eventos' // 🆕 ONDA 17 — Eventos de arrecadação

/**
 * Re-exporta UserRole como Role pra manter compatibilidade com o hook.
 */
export type Role = UserRole

/**
 * Módulos que tem trava temporal para operador
 * (só pode editar/excluir registros cuja DATA seja hoje).
 */
export const TIME_LOCKED_MODULES: Module[] = [
  'doacoes',
  'distribuicoes',
  'colheita-solidaria',
]

/**
 * Quais módulos cada role pode VER (aparecer no menu / acessar a rota).
 */
const VIEW_PERMISSIONS: Record<UserRole, Module[]> = {
  admin: [
    'dashboard', 'produtos', 'doadores', 'beneficiarios', 'funcionarios',
    'produtores', 'doacoes', 'distribuicoes', 'colheita-solidaria',
    'estoque', 'usuarios', 'indicadores',
    'eventos', // 🆕 ONDA 17
  ],
  operador: [
    'dashboard', 'produtos', 'doadores', 'beneficiarios', 'funcionarios',
    'produtores', 'doacoes', 'distribuicoes', 'colheita-solidaria',
    'estoque', 'indicadores',
    'eventos', // 🆕 ONDA 17 — vê a lista; registro de recebimentos na 17.3
  ],
  visualizador: [
    'dashboard', 'produtos', 'doadores', 'beneficiarios',
    'doacoes', 'distribuicoes', 'colheita-solidaria', 'estoque',
    'indicadores',
    'eventos', // 🆕 ONDA 17 — apenas a LISTA (não acessa o detalhe)
  ],
}

/**
 * Quais módulos cada role pode EDITAR (criar/atualizar/excluir).
 * Para operador em módulos time-locked, ainda há a trava de data.
 *
 * ⚠️ ONDA 17.3 — 'eventos' aqui significa GERENCIAR o evento
 * (criar, editar, ativar, encerrar, locais, catálogo, operadores).
 * Isso continua SENDO SÓ ADMIN. O REGISTRO de recebimentos por
 * operador é uma permissão separada: canRegisterRecebimento().
 */
const EDIT_PERMISSIONS: Record<UserRole, Module[]> = {
  admin: [
    'produtos', 'doadores', 'beneficiarios', 'funcionarios', 'produtores',
    'doacoes', 'distribuicoes', 'colheita-solidaria', 'estoque', 'usuarios',
    'eventos', // 🆕 ONDA 17 — só admin GERENCIA eventos
  ],
  operador: [
    'doacoes', 'distribuicoes', 'colheita-solidaria',
    // 'eventos' NÃO entra aqui: operador NÃO gerencia eventos.
    // O registro de recebimentos (Opção A) usa canRegisterRecebimento().
  ],
  visualizador: [],
}

/**
 * Verifica se o role pode VISUALIZAR o módulo.
 */
export function canView(role: UserRole, module: Module): boolean {
  return VIEW_PERMISSIONS[role].includes(module)
}

/**
 * Verifica se o role pode EDITAR (criar/atualizar/excluir) o módulo.
 * Para módulos time-locked, use também canEditRecord().
 */
export function canEdit(role: UserRole, module: Module): boolean {
  return EDIT_PERMISSIONS[role].includes(module)
}

/**
 * 🆕 ONDA 17.3 — Registro de recebimentos em eventos (Opção A).
 *
 * ⚠️ REVOGADO PARCIALMENTE PELA DECISÃO #18 (08/07) — NÃO USE ISOLADAMENTE
 * COMO GATE FINAL. Esta função responde apenas à pergunta "a role, por si só,
 * já pode registrar em QUALQUER evento?". Isso vale para admin e operador.
 *
 * Para o perfil VISUALIZADOR, o gate real depende do VÍNCULO no evento
 * (EventoOperador { ativo:true }), que só pode ser avaliado com acesso ao
 * banco. Portanto, o gate definitivo é podeRegistrarNoEvento() abaixo.
 *
 * A trava de status (evento precisa estar ATIVO) continua na rota de recebimento.
 */
export function canRegisterRecebimento(role: UserRole): boolean {
  return role === 'admin' || role === 'operador'
}

/**
 * 🆕 17.6-h (Decisão #18) — Gate DEFINITIVO de registro de recebimento por evento.
 *
 * - admin      → sempre pode (qualquer evento ativo)
 * - operador   → sempre pode (qualquer evento ativo)
 * - visualizador → SÓ se tiver vínculo ATIVO no evento (EventoOperador { ativo:true })
 *
 * O parâmetro `temVinculoAtivo` deve ser resolvido pela camada que tem acesso
 * ao banco (page.tsx / rota de recebimento). A trava de status ATIVO é separada.
 *
 * ⚠️ Cada evento é uma unidade INDEPENDENTE de autorização para o visualizador:
 * vínculo em um evento NÃO libera outro.
 */
export function podeRegistrarNoEvento(
  role: UserRole,
  temVinculoAtivo: boolean,
): boolean {
  if (role === 'admin' || role === 'operador') return true
  if (role === 'visualizador') return temVinculoAtivo
  return false
}

/**
 * Extrai a string YYYY-MM-DD de uma data, lidando com fuso horário.
 */
function getDateString(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10)
  }
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Verifica se dois timestamps representam o mesmo dia do calendário.
 * Tolerante a fuso horário (vide getDateString).
 */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  return getDateString(a) === getDateString(b)
}

/**
 * Verifica se um operador pode editar/excluir um registro específico
 * em módulos com trava temporal (doações, distribuições, colheita).
 */
export function canEditRecord(
  role: UserRole,
  module: Module,
  recordDate: Date | string,
): boolean {
  if (!canEdit(role, module)) return false
  if (role === 'admin') return true
  if (TIME_LOCKED_MODULES.includes(module)) {
    return isSameDay(recordDate, new Date())
  }
  return true
}

/**
 * Verifica se um role pode EXCLUIR registros em módulos time-locked.
 * Apenas admin pode excluir doações, distribuições e colheitas.
 */
export function canDeleteRecord(role: UserRole, module: Module): boolean {
  if (!canEdit(role, module)) return false
  if (role === 'admin') return true
  // Operador NUNCA exclui registros de módulos time-locked
  if (TIME_LOCKED_MODULES.includes(module)) return false
  return true
}

/**
 * Retorna todos os módulos visíveis para o role (útil pro Sidebar).
 */
export function getVisibleModules(role: UserRole): Module[] {
  return VIEW_PERMISSIONS[role]
}

/**
 * Mapeia pathname → Module.
 * Usado pelo middleware (auth.config.ts) pra decidir acesso por URL.
 */
export function getModuleFromPath(pathname: string): Module | null {
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard'

  const routeMap: Array<[string, Module]> = [
    ['/produtos', 'produtos'],
    ['/doadores', 'doadores'],
    ['/beneficiarios', 'beneficiarios'],
    ['/funcionarios', 'funcionarios'],
    ['/produtores', 'produtores'],
    ['/doacoes', 'doacoes'],
    ['/distribuicoes', 'distribuicoes'],
    ['/colheita-solidaria', 'colheita-solidaria'],
    ['/estoque', 'estoque'],
    ['/usuarios', 'usuarios'],
    ['/indicadores', 'indicadores'],
    ['/eventos', 'eventos'], // 🆕 ONDA 17
  ]

  for (const [prefix, module] of routeMap) {
    if (pathname.startsWith(prefix)) return module
  }

  return null
}

/**
 * Verifica se um role pode ACESSAR uma rota (pathname).
 * Usado pelo middleware do NextAuth.
 *
 * ⚠️ Nota: o middleware libera /eventos e /eventos/[id] igual (ambos → módulo
 * 'eventos'). O bloqueio do DETALHE para visualizador é feito DENTRO da
 * página /eventos/[id]/page.tsx (defesa em profundidade), pois o middleware
 * não distingue lista de detalhe.
 */
export function canAccessRoute(
  role: UserRole | undefined,
  pathname: string,
): boolean {
  const module = getModuleFromPath(pathname)
  if (module === null) return true
  if (!role) return false
  return canView(role, module)
}

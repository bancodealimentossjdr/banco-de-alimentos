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

/**
 * Módulos que tem trava temporal para operador
 * (só pode editar/criar/excluir no mesmo dia da criação).
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
    'estoque', 'usuarios',
  ],
  operador: [
    'dashboard', 'produtos', 'doadores', 'beneficiarios', 'funcionarios',
    'produtores', 'doacoes', 'distribuicoes', 'colheita-solidaria',
    'estoque',
  ],
  visualizador: [
    'dashboard', 'produtos', 'doadores', 'beneficiarios',
    'doacoes', 'distribuicoes', 'colheita-solidaria', 'estoque',
  ],
}

/**
 * Quais módulos cada role pode EDITAR (criar/atualizar/excluir).
 * Para operador em módulos time-locked, ainda há a trava de data.
 */
const EDIT_PERMISSIONS: Record<UserRole, Module[]> = {
  admin: [
    'produtos', 'doadores', 'beneficiarios', 'funcionarios', 'produtores',
    'doacoes', 'distribuicoes', 'colheita-solidaria', 'estoque', 'usuarios',
  ],
  operador: [
    'doacoes', 'distribuicoes', 'colheita-solidaria',
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
 * Para operador em módulos time-locked, use também canEditRecord().
 */
export function canEdit(role: UserRole, module: Module): boolean {
  return EDIT_PERMISSIONS[role].includes(module)
}

/**
 * Verifica se dois timestamps pertencem ao mesmo dia (data local do servidor).
 */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/**
 * Verifica se um operador pode editar/excluir um registro específico
 * em módulos com trava temporal (doações, distribuições, colheita).
 *
 * Regra: só pode modificar se o registro foi criado no dia de HOJE.
 * Admin passa sempre. Visualizador nunca passa.
 */
export function canEditRecord(
  role: UserRole,
  module: Module,
  recordCreatedAt: Date | string,
): boolean {
  if (!canEdit(role, module)) return false
  if (role === 'admin') return true
  if (TIME_LOCKED_MODULES.includes(module)) {
    return isSameDay(recordCreatedAt, new Date())
  }
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
 *
 * Retorna null para rotas que não são módulos controlados
 * (ex: /, /login, /api/auth/*, /register) → acesso liberado por padrão.
 */
export function getModuleFromPath(pathname: string): Module | null {
  // Dashboard = raiz
  if (pathname === '/' || pathname === '/dashboard') return 'dashboard'

  // Mapeamento direto: prefixo da URL → módulo
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
 * - Rotas não mapeadas (ex: /register, assets) → liberadas.
 * - Rotas mapeadas → checa via canView.
 * - Sem role (não logado) → bloqueia.
 */
export function canAccessRoute(
  role: UserRole | undefined,
  pathname: string,
): boolean {
  const module = getModuleFromPath(pathname)

  // Rota não mapeada (ex: APIs diversas, assets) → deixa passar,
  // a proteção específica fica nas próprias APIs via requireAuth/requireRole.
  if (module === null) return true

  // Rota mapeada mas sem role → bloqueia
  if (!role) return false

  return canView(role, module)
}

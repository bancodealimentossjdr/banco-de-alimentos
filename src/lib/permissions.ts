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
 * Extrai a string YYYY-MM-DD de uma data, lidando com fuso horário.
 *
 * - String ISO do Prisma ("2026-04-26T00:00:00.000Z") → "2026-04-26"
 *   (pega os 10 primeiros chars, que são a data em UTC — exatamente o
 *   dia que o usuário escolheu no <input type="date">).
 * - Date local (ex: new Date() = "agora") → YYYY-MM-DD no fuso local.
 *
 * Isso garante comparação correta entre a data do registro (salva como
 * UTC midnight pelo Prisma) e "hoje" (Date local), sem o bug clássico
 * de fuso "voltar um dia" no Brasil (UTC-3).
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
 *
 * Regra: só pode modificar se a DATA DO REGISTRO (campo `date`) for HOJE.
 * Mesmo se for retroativo, se a `date` não for hoje, NÃO pode editar.
 * Admin passa sempre. Visualizador nunca passa.
 *
 * @param recordDate - O campo `date` do registro (data da doação/distribuição/colheita)
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
 *
 * Retorna null para rotas que não são módulos controlados
 * (ex: /, /login, /api/auth/*, /register) → acesso liberado por padrão.
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
  if (module === null) return true
  if (!role) return false
  return canView(role, module)
}

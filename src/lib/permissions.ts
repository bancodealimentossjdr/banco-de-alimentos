import type { UserRole } from '@/types/next-auth'

export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/': ['admin', 'operador'],
  '/estoque': ['admin', 'operador'],
  '/doacoes': ['admin', 'operador'],
  '/distribuicoes': ['admin', 'operador'],
  '/colheita-solidaria': ['admin', 'operador'],
  '/produtos': ['admin', 'operador'],
  '/doadores': ['admin', 'operador'],
  '/beneficiarios': ['admin', 'operador'],
  '/funcionarios': ['admin', 'operador'],
  '/produtores': ['admin', 'operador'],
  '/usuarios': ['admin'],
}

export const WRITE_PERMISSIONS = {
  dashboard: ['admin', 'operador'],
  estoque: ['admin', 'operador'],
  doacoes: ['admin', 'operador'],
  distribuicoes: ['admin', 'operador'],
  'colheita-solidaria': ['admin', 'operador'],
  produtos: ['admin'],
  doadores: ['admin'],
  beneficiarios: ['admin'],
  funcionarios: ['admin'],
  produtores: ['admin'],
  usuarios: ['admin'],
} as const satisfies Record<string, UserRole[]>

export type WriteResource = keyof typeof WRITE_PERMISSIONS

export function canAccessRoute(role: UserRole | undefined, pathname: string): boolean {
  if (!role) return false

  const matchedRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => pathname === route || pathname.startsWith(route + '/'))
    .sort((a, b) => b.length - a.length)[0]

  if (!matchedRoute) return true

  return ROUTE_PERMISSIONS[matchedRoute].includes(role)
}

export function can(role: UserRole | undefined, resource: WriteResource): boolean {
  if (!role) return false
  return (WRITE_PERMISSIONS[resource] as readonly UserRole[]).includes(role)
}

export function isAdmin(role: UserRole | undefined): boolean {
  return role === 'admin'
}

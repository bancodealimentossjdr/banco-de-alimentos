'use client'

import { useSession } from 'next-auth/react'
import {
  canView as libCanView,
  canEdit as libCanEdit,
  canEditRecord as libCanEditRecord,
  canDeleteRecord as libCanDeleteRecord,
  type Module,
  type Role,
} from '@/lib/permissions'

export type { Module, Role }

/**
 * 🔐 E-mails com privilégio de desenvolvedor.
 * Espelha a mesma lista usada no servidor (src/lib/dev.ts).
 * O frontend NUNCA é fonte de verdade — o backend revalida.
 */
const DEV_EMAILS = (process.env.NEXT_PUBLIC_DEV_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export function usePermissions() {
  const { data: session, status } = useSession()

  const role = (session?.user?.role as Role | undefined) ?? 'visualizador'
  const email = session?.user?.email?.toLowerCase() ?? ''

  const isAdmin = role === 'admin'
  const isOperador = role === 'operador'
  const isVisualizador = role === 'visualizador'
  const isLoading = status === 'loading'

  /**
   * É desenvolvedor?
   * Aceita role 'dev' (caso o enum seja ampliado) OU e-mail na allowlist.
   */
  const isDev =
    (role as string) === 'dev' || (email !== '' && DEV_EMAILS.includes(email))

  const canEdit = (module: Module): boolean => {
    if (!session) return false
    return libCanEdit(role, module)
  }

  const canEditRecord = (module: Module, recordDate: Date | string): boolean => {
    if (!session) return false
    return libCanEditRecord(role, module, recordDate)
  }

  const canDelete = (module: Module): boolean => {
    if (!session) return false
    return libCanDeleteRecord(role, module)
  }

  const canView = (module: Module): boolean => {
    if (!session) return false
    return libCanView(role, module)
  }

  /**
   * 👁️ Pode ocultar/reexibir registros (visibilidade dev)?
   * Exclusivo do desenvolvedor. Backend revalida em toda requisição.
   */
  const canToggleVisibility = (): boolean => {
    if (!session) return false
    return isDev
  }

  return {
    role,
    isAdmin,
    isOperador,
    isVisualizador,
    isDev,
    isLoading,
    canEdit,
    canEditRecord,
    canDelete,
    canView,
    canToggleVisibility,
  }
}

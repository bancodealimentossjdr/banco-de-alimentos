'use client'

import { useSession } from 'next-auth/react'
import {
  canEdit as canEditFn,
  canEditRecord as canEditRecordFn,
  canView as canViewFn,
  type Module,
} from '@/lib/permissions'
import type { UserRole } from '@/types/next-auth'

type PermissionsHook = {
  role: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  isAdmin: boolean
  isOperador: boolean
  isVisualizador: boolean
  canView: (module: Module) => boolean
  canEdit: (module: Module) => boolean
  canEditRecord: (module: Module, createdAt: Date | string) => boolean
}

export function usePermissions(): PermissionsHook {
  const { data: session, status } = useSession()
  const role = (session?.user?.role ?? null) as UserRole | null

  return {
    role,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    isAdmin: role === 'admin',
    isOperador: role === 'operador',
    isVisualizador: role === 'visualizador',
    canView: (module) => (role ? canViewFn(role, module) : false),
    canEdit: (module) => (role ? canEditFn(role, module) : false),
    canEditRecord: (module, createdAt) =>
      role ? canEditRecordFn(role, module, createdAt) : false,
  }
}

import { prisma } from '@/lib/prisma'
import type { Module } from '@/lib/permissions'

/**
 * 🆕 Módulos que o DEV pode ocultar da sidebar (obra em produção).
 * Núcleo operacional fica FORA — não se esconde o que a ONG usa todo dia.
 */
export const HIDEABLE_MODULES: Module[] = [
  'paa',
  'eventos',
  'indicadores',
  'produtores',
  'colheita-solidaria',
]

export type ModuleFlagMap = Partial<Record<Module, boolean>>

/** Lê as flags do banco. Fail-open: erro → tudo habilitado. */
export async function getModuleFlags(): Promise<ModuleFlagMap> {
  try {
    const rows = await prisma.moduleFlag.findMany({
      where: { module: { in: HIDEABLE_MODULES } },
      select: { module: true, enabled: true },
    })
    const map: ModuleFlagMap = {}
    for (const r of rows) map[r.module as Module] = r.enabled
    return map
  } catch {
    return {}
  }
}

/** Regra única de visibilidade cosmética. dev ignora a flag e vê tudo. */
export function isModuleHidden(
  module: Module,
  flags: ModuleFlagMap,
  isDev: boolean,
): boolean {
  if (isDev) return false
  if (!HIDEABLE_MODULES.includes(module)) return false
  return flags[module] === false
}

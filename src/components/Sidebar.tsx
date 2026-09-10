'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import {
  LayoutDashboard,
  Package,
  Users,
  HandHeart,
  ClipboardList,
  Truck,
  Warehouse,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Tractor,
  Sprout,
  Shield,
  BarChart3,
  PartyPopper,
  Wheat,
  Eye,
  EyeOff,
  X,
} from 'lucide-react'
import { LogoFull, LogoMark } from '@/components/ui/Logo'
import { BRANDING } from '@/lib/branding'
import { getVisibleModules, type Module } from '@/lib/permissions'
import {
  HIDEABLE_MODULES,
  isModuleHidden,
  type ModuleFlagMap,
} from '@/lib/module-flags'

type MenuItem = {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Módulo do permissions.ts — fonte única de verdade da visibilidade. */
  module: Module
}

const menuItems: MenuItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Produtos', href: '/produtos', icon: Package, module: 'produtos' },
  { label: 'Doadores', href: '/doadores', icon: HandHeart, module: 'doadores' },
  { label: 'Beneficiários', href: '/beneficiarios', icon: Users, module: 'beneficiarios' },
  { label: 'Funcionários', href: '/funcionarios', icon: UserCog, module: 'funcionarios' },
  { label: 'Produtores', href: '/produtores', icon: Tractor, module: 'produtores' },
  { label: 'Doações', href: '/doacoes', icon: ClipboardList, module: 'doacoes' },
  { label: 'Distribuições', href: '/distribuicoes', icon: Truck, module: 'distribuicoes' },
  { label: 'Colheita Solidária', href: '/colheita-solidaria', icon: Sprout, module: 'colheita-solidaria' },
  { label: 'PAA', href: '/paa', icon: Wheat, module: 'paa' }, // 🆕 ONDA 23
  { label: 'Estoque', href: '/estoque', icon: Warehouse, module: 'estoque' },
  { label: 'Eventos', href: '/eventos', icon: PartyPopper, module: 'eventos' },
  { label: 'Indicadores', href: '/indicadores', icon: BarChart3, module: 'indicadores' },
  { label: 'Usuários', href: '/usuarios', icon: Shield, module: 'usuarios' },
]

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
}

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  collapsed,
  setCollapsed,
}: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const role = session?.user?.role
  const isDev = role === 'dev'

  // 🆕 Flags de módulo (ocultação cosmética controlada pelo dev).
  // null = ainda não carregou → evita "piscar" módulo oculto pro usuário comum.
  const [flags, setFlags] = useState<ModuleFlagMap | null>(null)
  const [saving, setSaving] = useState<Module | null>(null)

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false

    fetch('/api/dev/module-flags')
      .then((r) => (r.ok ? r.json() : { flags: {} }))
      .then((data) => {
        if (!cancelled) setFlags(data.flags ?? {})
      })
      .catch(() => {
        if (!cancelled) setFlags({})
      })

    return () => {
      cancelled = true
    }
  }, [session?.user])

  // 🔐 Visibilidade derivada de VIEW_PERMISSIONS (permissions.ts).
  const allowed = role ? getVisibleModules(role) : []

  const visibleItems = menuItems.filter((item) => {
    if (!allowed.includes(item.module)) return false
    if (isDev) return true

    // Anti-flicker: enquanto as flags não chegam, esconde os ocultáveis.
    if (flags === null) return !HIDEABLE_MODULES.includes(item.module)

    return !isModuleHidden(item.module, flags, false)
  })

  async function toggleModule(module: Module, currentlyEnabled: boolean) {
    setSaving(module)
    const next = !currentlyEnabled

    // Otimista
    setFlags((prev) => ({ ...(prev ?? {}), [module]: next }))

    try {
      const res = await fetch('/api/dev/module-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, enabled: next }),
      })
      if (!res.ok) throw new Error()
      toast.success(next ? 'Módulo visível para todos' : 'Módulo oculto (só dev vê)')
    } catch {
      // Rollback
      setFlags((prev) => ({ ...(prev ?? {}), [module]: currentlyEnabled }))
      toast.error('Falha ao atualizar o módulo')
    } finally {
      setSaving(null)
    }
  }

  const showFullLogo = !collapsed || sidebarOpen
  const showLabel = !collapsed || sidebarOpen

  return (
    <>
      {/* Overlay escuro no mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-screen bg-green-800 text-white flex flex-col transition-all duration-300
          ${collapsed ? 'lg:w-16 w-64' : 'w-64'}
          ${sidebarOpen
            ? 'translate-x-0 z-50'
            : '-translate-x-full pointer-events-none lg:pointer-events-auto lg:translate-x-0 z-50'
          }
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-3 h-16 border-b border-green-700">
          {showFullLogo ? (
            <Link href="/" className="flex items-center min-w-0" title={BRANDING.fullName}>
              <LogoFull size={36} />
            </Link>
          ) : (
            <Link
              href="/"
              className="flex items-center justify-center w-full"
              title={BRANDING.name}
            >
              <LogoMark size={32} />
            </Link>
          )}

          {/* Botão fechar - mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded hover:bg-green-700 transition-colors lg:hidden"
            aria-label="Fechar menu"
          >
            <X size={20} />
          </button>

          {/* Botão colapsar - desktop */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-green-700 transition-colors hidden lg:block"
            aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {visibleItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)

              // 🆕 Toggle só aparece pro dev, em módulos ocultáveis, menu expandido.
              const canToggle =
                isDev && HIDEABLE_MODULES.includes(item.module) && showLabel

              const enabled = flags?.[item.module] !== false
              const isSaving = saving === item.module

              return (
                <li key={item.href} className="relative group">
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-green-600 text-white font-semibold'
                        : 'text-green-100 hover:bg-green-700'
                    } ${canToggle ? 'pr-10' : ''}`}
                    title={!showLabel ? item.label : undefined}
                  >
                    <item.icon size={20} className="shrink-0" />
                    {showLabel && (
                      <span
                        className={`truncate ${
                          canToggle && !enabled ? 'italic opacity-60' : ''
                        }`}
                      >
                        {item.label}
                      </span>
                    )}
                    {canToggle && !enabled && (
                      <span className="text-[10px] shrink-0" title="Em obra — oculto">
                        🚧
                      </span>
                    )}
                  </Link>

                  {canToggle && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        toggleModule(item.module, enabled)
                      }}
                      disabled={isSaving}
                      className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded
                        transition-colors disabled:opacity-40
                        ${enabled
                          ? 'text-green-300 hover:text-white hover:bg-green-600'
                          : 'text-amber-300 hover:text-white hover:bg-green-600'
                        }`}
                      title={
                        enabled
                          ? `Ocultar "${item.label}" dos outros usuários`
                          : `Reativar "${item.label}" para todos`
                      }
                      aria-label={
                        enabled ? `Ocultar ${item.label}` : `Reativar ${item.label}`
                      }
                    >
                      {enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        {showFullLogo && (
          <div className="px-4 py-3 border-t border-green-700 text-xs text-green-300">
            © {new Date().getFullYear()} {BRANDING.name}
          </div>
        )}
      </aside>
    </>
  )
}

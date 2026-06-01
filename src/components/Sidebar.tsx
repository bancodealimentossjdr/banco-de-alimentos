'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
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
  X,
} from 'lucide-react'
import { BRANDING } from '@/lib/branding'

type MenuItem = {
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  adminOnly?: boolean
}

const menuItems: MenuItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Produtos', href: '/produtos', icon: Package },
  { label: 'Doadores', href: '/doadores', icon: HandHeart },
  { label: 'Beneficiários', href: '/beneficiarios', icon: Users },
  { label: 'Funcionários', href: '/funcionarios', icon: UserCog },
  { label: 'Produtores', href: '/produtores', icon: Tractor },
  { label: 'Doações', href: '/doacoes', icon: ClipboardList },
  { label: 'Distribuições', href: '/distribuicoes', icon: Truck },
  { label: 'Colheita Solidária', href: '/colheita-solidaria', icon: Sprout },
  { label: 'Estoque', href: '/estoque', icon: Warehouse },
  { label: 'Indicadores', href: '/indicadores', icon: BarChart3 },
  { label: 'Usuários', href: '/usuarios', icon: Shield, adminOnly: true },
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

  const isAdmin = session?.user.role === 'admin'
  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin)

  // Mostrar texto completo: quando NÃO colapsada OU quando aberta no mobile
  const showFullLogo = !collapsed || sidebarOpen

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
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <Image
                src={BRANDING.assets.logoMono}
                alt={BRANDING.name}
                width={140}
                height={36}
                priority
                className="object-contain h-9 w-auto"
              />
            </Link>
          ) : (
            <Link href="/" className="flex items-center justify-center w-full">
              <Image
                src={BRANDING.assets.logoMono}
                alt={BRANDING.name}
                width={32}
                height={32}
                priority
                className="object-contain h-8 w-8"
              />
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
              const isActive = pathname === item.href
              const showLabel = !collapsed || sidebarOpen
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-green-600 text-white font-semibold'
                        : 'text-green-100 hover:bg-green-700'
                    }`}
                    title={!showLabel ? item.label : undefined}
                  >
                    <item.icon size={20} className="shrink-0" />
                    {showLabel && <span className="truncate">{item.label}</span>}
                  </Link>
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

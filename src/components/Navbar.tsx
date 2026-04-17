'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { User, Menu, LogOut, ChevronDown, Shield, UserCog, Eye } from 'lucide-react'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/produtos': 'Produtos',
  '/doadores': 'Doadores',
  '/beneficiarios': 'Beneficiários',
  '/funcionarios': 'Funcionários',
  '/produtores': 'Produtores',
  '/doacoes': 'Doações',
  '/distribuicoes': 'Distribuições',
  '/colheita-solidaria': 'Colheita Solidária',
  '/estoque': 'Estoque',
  '/usuarios': 'Usuários',
}

const roleLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  admin: { label: 'Administrador', icon: Shield, color: 'text-red-600 bg-red-50' },
  operador: { label: 'Operador', icon: UserCog, color: 'text-blue-600 bg-blue-50' },
  visualizador: { label: 'Visualizador', icon: Eye, color: 'text-gray-600 bg-gray-100' },
}

interface NavbarProps {
  onMenuClick: () => void
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const title = pageTitles[pathname] || 'Banco de Alimentos'
  const userName = session?.user?.name || 'Usuário'
  const userRole = session?.user?.role || 'operador'
  const roleInfo = roleLabels[userRole] || roleLabels.operador
  const RoleIcon = roleInfo.icon

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Pega as iniciais do nome
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
        >
          <Menu size={22} className="text-gray-600" />
        </button>

        <h1 className="text-lg md:text-xl font-bold text-gray-800">{title}</h1>
      </div>

      {/* Usuário com Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">{initials}</span>
          </div>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-medium text-gray-700 leading-tight">{userName}</span>
            <span className="text-xs text-gray-400 leading-tight">{roleInfo.label}</span>
          </div>
          <ChevronDown
            size={16}
            className={`text-gray-400 hidden sm:block transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
            {/* Info do usuário */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">{userName}</p>
              <p className="text-xs text-gray-400 mt-0.5">{session?.user?.email}</p>
              <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                <RoleIcon size={12} />
                {roleInfo.label}
              </div>
            </div>

            {/* Botão Sair */}
            <div className="px-2 pt-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut size={16} />
                Sair do sistema
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

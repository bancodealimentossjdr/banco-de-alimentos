'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Sidebar from '@/components/Sidebar'
import Navbar from '@/components/Navbar'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { status } = useSession()

  // Fecha o menu mobile ao navegar
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Fecha o menu mobile ao redimensionar para desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isLoginPage = pathname === '/login'

  if (status === 'loading' && !isLoginPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Carregando...</p>
        </div>
      </div>
    )
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    // 🔧 overflow-x-hidden na raiz = trava de segurança contra qualquer estouro horizontal
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* Área principal — 🔧 min-w-0 permite encolher abaixo do conteúdo (fix do overflow em flex) */}
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ${
          collapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        {/* 🔧 min-w-0 + overflow-x-hidden no main também */}
        <main className="min-w-0 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

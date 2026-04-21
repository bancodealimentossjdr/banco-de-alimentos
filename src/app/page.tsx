'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'

interface DashboardData {
  totalDonors: number
  totalBeneficiaries: number
  totalProducts: number
  totalEmployees: number
  totalDonations: number
  totalDistributions: number
  totalProducers: number
  totalHarvests: number
  recentDonations: {
    id: string
    date: string
    donor: { name: string }
    items: { quantity: number; product: { name: string; unit: string } }[]
  }[]
  recentDistributions: {
    id: string
    date: string
    beneficiary: { name: string }
    items: { quantity: number; product: { name: string; unit: string } }[]
  }[]
  recentHarvests: {
    id: string
    date: string
    producer: { name: string }
    items: { quantity: number; product: { name: string; unit: string } }[]
  }[]
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'doacoes' | 'distribuicoes' | 'colheitas'>('doacoes')
  const hasFetched = useRef(false)

  const fetchData = useCallback(async () => {
    if (hasFetched.current) return
    hasFetched.current = true

    try {
      const res = await fetch('/api/dashboard')
      if (!res.ok) throw new Error('Erro na API')
      const dash = await res.json()
      setData(dash)
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const formatDate = (date: string) => {
    const raw = date.includes('T') ? date.split('T')[0] : date
    const [year, month, day] = raw.split('-')
    return `${day}/${month}/${year}`
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-sm text-gray-400">Carregando painel...</p>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Painel de Controle</h2>
        <p className="text-gray-500 text-sm mt-0.5">Visão geral do sistema</p>
      </div>

      {/* ====== CONTADORES ====== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Link href="/doadores" className="bg-white rounded-xl shadow-sm border p-3 md:p-4 text-center hover:shadow-md transition active:scale-95">
          <p className="text-xl md:text-2xl mb-0.5">🤝</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{data?.totalDonors || 0}</p>
          <p className="text-xs text-gray-500">Doadores</p>
        </Link>
        <Link href="/beneficiarios" className="bg-white rounded-xl shadow-sm border p-3 md:p-4 text-center hover:shadow-md transition active:scale-95">
          <p className="text-xl md:text-2xl mb-0.5">👥</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{data?.totalBeneficiaries || 0}</p>
          <p className="text-xs text-gray-500">Instituições</p>
        </Link>
        <Link href="/produtos" className="bg-white rounded-xl shadow-sm border p-3 md:p-4 text-center hover:shadow-md transition active:scale-95">
          <p className="text-xl md:text-2xl mb-0.5">📦</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{data?.totalProducts || 0}</p>
          <p className="text-xs text-gray-500">Produtos</p>
        </Link>
        <Link href="/funcionarios" className="bg-white rounded-xl shadow-sm border p-3 md:p-4 text-center hover:shadow-md transition active:scale-95">
          <p className="text-xl md:text-2xl mb-0.5">👷</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{data?.totalEmployees || 0}</p>
          <p className="text-xs text-gray-500">Funcionários</p>
        </Link>
        <Link href="/produtores" className="bg-white rounded-xl shadow-sm border p-3 md:p-4 text-center hover:shadow-md transition active:scale-95">
          <p className="text-xl md:text-2xl mb-0.5">🚜</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{data?.totalProducers || 0}</p>
          <p className="text-xs text-gray-500">Produtores</p>
        </Link>
        <Link href="/doacoes" className="bg-white rounded-xl shadow-sm border p-3 md:p-4 text-center hover:shadow-md transition active:scale-95">
          <p className="text-xl md:text-2xl mb-0.5">📥</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{data?.totalDonations || 0}</p>
          <p className="text-xs text-gray-500">Doações</p>
        </Link>
        <Link href="/distribuicoes" className="bg-white rounded-xl shadow-sm border p-3 md:p-4 text-center hover:shadow-md transition active:scale-95">
          <p className="text-xl md:text-2xl mb-0.5">📤</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{data?.totalDistributions || 0}</p>
          <p className="text-xs text-gray-500">Distribuições</p>
        </Link>
        <Link href="/colheita-solidaria" className="bg-white rounded-xl shadow-sm border p-3 md:p-4 text-center hover:shadow-md transition active:scale-95">
          <p className="text-xl md:text-2xl mb-0.5">🌱</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900">{data?.totalHarvests || 0}</p>
          <p className="text-xs text-gray-500">Colheitas</p>
        </Link>
      </div>

      {/* ====== ATALHOS DE AÇÃO ====== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
        <Link href="/estoque" className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl shadow-sm p-4 md:p-6 text-white hover:shadow-md transition active:scale-[0.98] flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0">
          <span className="text-2xl sm:mb-2">📊</span>
          <div>
            <h3 className="text-base md:text-lg font-bold">Ver Estoque</h3>
            <p className="text-xs md:text-sm text-teal-100 hidden sm:block">Acompanhe os níveis em tempo real</p>
          </div>
        </Link>
        <Link href="/doacoes" className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-sm p-4 md:p-6 text-white hover:shadow-md transition active:scale-[0.98] flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0">
          <span className="text-2xl sm:mb-2">➕</span>
          <div>
            <h3 className="text-base md:text-lg font-bold">Registrar Doação</h3>
            <p className="text-xs md:text-sm text-green-100 hidden sm:block">Cadastre uma nova doação recebida</p>
          </div>
        </Link>
        <Link href="/colheita-solidaria" className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl shadow-sm p-4 md:p-6 text-white hover:shadow-md transition active:scale-[0.98] flex sm:flex-col items-center sm:items-start gap-3 sm:gap-0">
          <span className="text-2xl sm:mb-2">🌾</span>
          <div>
            <h3 className="text-base md:text-lg font-bold">Colheita Solidária</h3>
            <p className="text-xs md:text-sm text-amber-100 hidden sm:block">Gerencie colheitas de produtores</p>
          </div>
        </Link>
      </div>

      {/* ====== ATIVIDADES RECENTES - Desktop ====== */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold text-gray-900 mb-4">📥 Últimas Doações</h3>
          {data?.recentDonations && data.recentDonations.length > 0 ? (
            <div className="space-y-3">
              {data.recentDonations.slice(0, 5).map(d => (
                <div key={d.id} className="flex justify-between items-start border-b pb-2 last:border-0 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.donor.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {d.items.map(i => `${i.product.name}: ${i.quantity}${i.product.unit}`).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(d.date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Nenhuma doação registrada</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold text-gray-900 mb-4">📤 Últimas Distribuições</h3>
          {data?.recentDistributions && data.recentDistributions.length > 0 ? (
            <div className="space-y-3">
              {data.recentDistributions.slice(0, 5).map(d => (
                <div key={d.id} className="flex justify-between items-start border-b pb-2 last:border-0 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.beneficiary.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {d.items.map(i => `${i.product.name}: ${i.quantity}${i.product.unit}`).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(d.date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Nenhuma distribuição registrada</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h3 className="font-bold text-gray-900 mb-4">🌱 Últimas Colheitas</h3>
          {data?.recentHarvests && data.recentHarvests.length > 0 ? (
            <div className="space-y-3">
              {data.recentHarvests.slice(0, 5).map(d => (
                <div key={d.id} className="flex justify-between items-start border-b pb-2 last:border-0 gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.producer.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {d.items.map(i => `${i.product.name}: ${i.quantity}${i.product.unit}`).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{formatDate(d.date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Nenhuma colheita registrada</p>
          )}
        </div>
      </div>

      {/* ====== ATIVIDADES RECENTES - Mobile (Tabs) ====== */}
      <div className="md:hidden">
        <div className="flex bg-white rounded-xl shadow-sm border overflow-hidden mb-3">
          <button
            onClick={() => setActiveTab('doacoes')}
            className={`flex-1 py-3 text-center text-xs font-medium transition ${
              activeTab === 'doacoes'
                ? 'bg-green-500 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            📥 Doações
          </button>
          <button
            onClick={() => setActiveTab('distribuicoes')}
            className={`flex-1 py-3 text-center text-xs font-medium transition border-x ${
              activeTab === 'distribuicoes'
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            📤 Distribuições
          </button>
          <button
            onClick={() => setActiveTab('colheitas')}
            className={`flex-1 py-3 text-center text-xs font-medium transition ${
              activeTab === 'colheitas'
                ? 'bg-amber-500 text-white'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            🌱 Colheitas
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          {activeTab === 'doacoes' && (
            <>
              <h3 className="font-bold text-gray-900 mb-3 text-sm">📥 Últimas Doações</h3>
              {data?.recentDonations && data.recentDonations.length > 0 ? (
                <div className="space-y-3">
                  {data.recentDonations.slice(0, 5).map(d => (
                    <div key={d.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{d.donor.name}</p>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">{formatDate(d.date)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {d.items.map((item, idx) => (
                          <span key={idx} className="inline-flex px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">
                            {item.product.name}: {item.quantity}{item.product.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">Nenhuma doação registrada</p>
              )}
            </>
          )}

          {activeTab === 'distribuicoes' && (
            <>
              <h3 className="font-bold text-gray-900 mb-3 text-sm">📤 Últimas Distribuições</h3>
              {data?.recentDistributions && data.recentDistributions.length > 0 ? (
                <div className="space-y-3">
                  {data.recentDistributions.slice(0, 5).map(d => (
                    <div key={d.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{d.beneficiary.name}</p>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">{formatDate(d.date)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {d.items.map((item, idx) => (
                          <span key={idx} className="inline-flex px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                            {item.product.name}: {item.quantity}{item.product.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">Nenhuma distribuição registrada</p>
              )}
            </>
          )}

          {activeTab === 'colheitas' && (
            <>
              <h3 className="font-bold text-gray-900 mb-3 text-sm">🌱 Últimas Colheitas</h3>
              {data?.recentHarvests && data.recentHarvests.length > 0 ? (
                <div className="space-y-3">
                  {data.recentHarvests.slice(0, 5).map(d => (
                    <div key={d.id} className="border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{d.producer.name}</p>
                        <span className="text-xs text-gray-400 shrink-0 ml-2">{formatDate(d.date)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {d.items.map((item, idx) => (
                          <span key={idx} className="inline-flex px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
                            {item.product.name}: {item.quantity}{item.product.unit}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-4">Nenhuma colheita registrada</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

interface StockItem {
  id: string
  name: string
  category: string
  unit: string
  minStock: number
  donated: number
  distributed: number
  stock: number
}

export default function EstoquePage() {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStock = async () => {
      try {
        const res = await fetch('/api/estoque')
        const data = await res.json()
        setItems(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('Erro ao buscar estoque:', error)
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    fetchStock()
  }, [])

  const getStockStatus = (item: StockItem) => {
    if (item.stock <= 0) return { label: 'Zerado', style: 'bg-red-100 text-red-700', barColor: 'bg-red-500' }
    if (item.stock <= item.minStock) return { label: 'Baixo', style: 'bg-yellow-100 text-yellow-700', barColor: 'bg-yellow-500' }
    return { label: 'OK', style: 'bg-green-100 text-green-700', barColor: 'bg-green-500' }
  }

  const totalStock = items.reduce((acc, i) => acc + i.stock, 0)
  const totalDonated = items.reduce((acc, i) => acc + i.donated, 0)
  const totalDistributed = items.reduce((acc, i) => acc + i.distributed, 0)

  return (
    <div>
      {/* Header da página */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">📊 Estoque</h2>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
        </div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-6 text-center">
              <p className="text-xs sm:text-sm text-gray-500">Recebido</p>
              <p className="text-lg sm:text-3xl font-bold text-green-600">{totalDonated.toFixed(1)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-6 text-center">
              <p className="text-xs sm:text-sm text-gray-500">Distribuído</p>
              <p className="text-lg sm:text-3xl font-bold text-red-600">{totalDistributed.toFixed(1)}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-6 text-center">
              <p className="text-xs sm:text-sm text-gray-500">Em Estoque</p>
              <p className="text-lg sm:text-3xl font-bold text-teal-600">{totalStock.toFixed(1)}</p>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-6xl mb-4">📊</p>
              <p className="text-xl">Nenhum produto no estoque</p>
              <p className="text-sm mt-2">Cadastre produtos e registre doações para ver o estoque</p>
            </div>
          ) : (
            <>
              {/* ====== TABELA - só aparece em telas md+ ====== */}
              <div className="hidden md:block bg-white rounded-xl shadow-sm border">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="px-6 py-3 text-sm font-semibold text-gray-600">Produto</th>
                        <th className="px-6 py-3 text-sm font-semibold text-gray-600">Categoria</th>
                        <th className="px-6 py-3 text-sm font-semibold text-gray-600">Recebido</th>
                        <th className="px-6 py-3 text-sm font-semibold text-gray-600">Distribuído</th>
                        <th className="px-6 py-3 text-sm font-semibold text-gray-600">Estoque</th>
                        <th className="px-6 py-3 text-sm font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(item => {
                        const status = getStockStatus(item)
                        return (
                          <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                            <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                            <td className="px-6 py-4 text-gray-600">{item.category}</td>
                            <td className="px-6 py-4 text-green-600">{item.donated.toFixed(1)} {item.unit}</td>
                            <td className="px-6 py-4 text-red-600">{item.distributed.toFixed(1)} {item.unit}</td>
                            <td className="px-6 py-4 font-bold text-gray-900">{item.stock.toFixed(1)} {item.unit}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.style}`}>
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ====== CARDS - só aparece no mobile (< md) ====== */}
              <div className="md:hidden space-y-3">
                {items.map(item => {
                  const status = getStockStatus(item)
                  const usagePercent = item.donated > 0
                    ? Math.min(100, Math.round((item.distributed / item.donated) * 100))
                    : 0

                  return (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border p-4">
                      {/* Topo: nome + status */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">{item.name}</h3>
                          <span className="text-xs text-gray-500">{item.category}</span>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${status.style}`}>
                          {status.label}
                        </span>
                      </div>

                      {/* Barra de uso visual */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Uso: {usagePercent}%</span>
                          <span>Mín: {item.minStock} {item.unit}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${status.barColor}`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Números: entrada / saída / saldo */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-green-50 rounded-lg py-2 px-1">
                          <p className="text-xs text-green-600 font-medium">Recebido</p>
                          <p className="text-sm font-bold text-green-700">
                            {item.donated.toFixed(1)}
                          </p>
                          <p className="text-xs text-green-500">{item.unit}</p>
                        </div>
                        <div className="bg-red-50 rounded-lg py-2 px-1">
                          <p className="text-xs text-red-600 font-medium">Distribuído</p>
                          <p className="text-sm font-bold text-red-700">
                            {item.distributed.toFixed(1)}
                          </p>
                          <p className="text-xs text-red-500">{item.unit}</p>
                        </div>
                        <div className="bg-teal-50 rounded-lg py-2 px-1">
                          <p className="text-xs text-teal-600 font-medium">Estoque</p>
                          <p className="text-sm font-bold text-teal-700">
                            {item.stock.toFixed(1)}
                          </p>
                          <p className="text-xs text-teal-500">{item.unit}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useApi } from '@/hooks/useApi'
import CalculadoraPeso from '@/components/CalculadoraPeso'

interface EstoqueResumo {
  donations: number
  solidarityHarvest: number
  approved: number
  distributed: number
  inStock: number
}

interface PreviewDonation {
  donorId: string
  donorName: string
  quantity: number
}

interface PreviewData {
  date: string
  donations: PreviewDonation[]
  donationsTotal: number
  harvestTotal: number
  totalReceived: number
  existingApproval: {
    id: string
    approvedQuantity: number
    notes: string | null
  } | null
}

interface CardConfig {
  key: keyof EstoqueResumo
  label: string
  emoji: string
  description: string
  bgColor: string
  borderColor: string
  textColor: string
  iconBg: string
}

const CARDS: CardConfig[] = [
  { key: 'donations', label: 'Doações', emoji: '🏪', description: 'Total recebido em doações', bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700', iconBg: 'bg-green-100' },
  { key: 'solidarityHarvest', label: 'Colheita Solidária', emoji: '🌾', description: 'Total da colheita solidária', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700', iconBg: 'bg-amber-100' },
  { key: 'approved', label: 'Aproveitado', emoji: '✅', description: 'Total aproveitado das doações', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700', iconBg: 'bg-blue-100' },
  { key: 'distributed', label: 'Distribuído', emoji: '📤', description: 'Total distribuído aos beneficiários', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700', iconBg: 'bg-purple-100' },
  { key: 'inStock', label: 'Em Estoque', emoji: '📦', description: 'Saldo atual disponível', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', textColor: 'text-emerald-700', iconBg: 'bg-emerald-100' },
]

const getHojeLocal = () => {
  const hoje = new Date()
  const ano = hoje.getFullYear()
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const dia = String(hoje.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

const formatDate = (date: string) => {
  const raw = date.includes('T') ? date.split('T')[0] : date
  const [y, m, d] = raw.split('-')
  return `${d}/${m}/${y}`
}

const formatKg = (valor: number | null | undefined) => {
  const n = typeof valor === 'number' && !isNaN(valor) ? valor : 0
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function EstoquePage() {
  const { canEdit } = usePermissions()
  const podeRegistrar = canEdit('doacoes')

  // 📊 Resumo do estoque (cache global)
  const {
    data: resumo,
    error: erroResumo,
    isLoading: loading,
    mutate: mutateResumo,
  } = useApi<EstoqueResumo>('/api/estoque/resumo', {
    dedupingInterval: 5_000, // 5s — estoque muda mais que cadastros
  })

  const erro = erroResumo ? 'Falha ao carregar resumo do estoque' : null

  // Modal state (controlado localmente — só carrega o preview quando abre)
  const [showModal, setShowModal] = useState(false)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [approvedQty, setApprovedQty] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [showCalculadora, setShowCalculadora] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // 🔍 Preview SÓ é buscado quando modal está aberto (previewKey != null)
  const {
    data: preview,
    error: erroPreview,
    isLoading: previewLoading,
  } = useApi<PreviewData>(previewKey, {
    dedupingInterval: 0, // sempre revalida ao abrir modal
    revalidateOnFocus: false,
    onSuccess: (data) => {
      // hidrata os campos do form ao carregar o preview pela 1ª vez
      if (!hydrated && data) {
        if (data.existingApproval) {
          setApprovedQty(String(data.existingApproval.approvedQuantity))
          setNotes(data.existingApproval.notes || '')
        } else {
          setApprovedQty(data.totalReceived > 0 ? String(data.totalReceived) : '')
          setNotes('')
        }
        setHydrated(true)
      }
    },
  })

  const previewErro = erroPreview ? 'Falha ao carregar preview' : null

  const abrirModal = () => {
    const hoje = getHojeLocal()
    setShowModal(true)
    setShowCalculadora(false)
    setHydrated(false)
    setPreviewKey(`/api/estoque/aproveitamentos/preview?date=${hoje}`)
  }

  const fecharModal = () => {
    if (salvando) return
    setShowModal(false)
    setPreviewKey(null)
    setApprovedQty('')
    setNotes('')
    setShowCalculadora(false)
    setHydrated(false)
  }

  const handleApplyCalc = (pesoLiquido: number) => {
    setApprovedQty(String(pesoLiquido))
    setShowCalculadora(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preview) return

    const qty = parseFloat(approvedQty.replace(',', '.'))
    if (isNaN(qty) || qty < 0) {
      alert('Informe uma quantidade válida.')
      return
    }
    if (qty > preview.totalReceived) {
      alert(`O aproveitado (${formatKg(qty)} kg) não pode ser maior que o total recebido (${formatKg(preview.totalReceived)} kg).`)
      return
    }

    try {
      setSalvando(true)
      const res = await fetch('/api/estoque/aproveitamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: preview.date,
          approvedQuantity: qty,
          notes: notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao salvar aproveitamento')
      }

      fecharModal()
      mutateResumo() // 🔄 atualiza o resumo
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const totalReceived = preview?.totalReceived ?? 0
  const semDados = preview !== undefined && preview !== null && totalReceived === 0

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">📊 Estoque</h2>
          <p className="text-sm text-gray-500 mt-1">Resumo de movimentações e saldo atual</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => mutateResumo()}
            disabled={loading}
            className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition text-sm disabled:opacity-50"
          >
            🔄 Atualizar
          </button>
          {podeRegistrar && (
            <button
              onClick={abrirModal}
              className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium transition text-sm"
            >
              ✅ Registrar Aproveitamento
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <p className="text-red-700 font-medium">⚠️ {erro}</p>
          <button onClick={() => mutateResumo()} className="text-red-600 hover:text-red-800 text-sm mt-2 font-medium underline">
            Tentar novamente
          </button>
        </div>
      )}

      {loading && !resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border p-5 animate-pulse">
              <div className="h-10 w-10 bg-gray-200 rounded-lg mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-3"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {resumo && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {CARDS.map((card) => (
              <div key={card.key} className={`${card.bgColor} ${card.borderColor} border-2 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow`}>
                <div className={`${card.iconBg} w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3`}>
                  {card.emoji}
                </div>
                <p className={`text-sm font-semibold ${card.textColor} mb-1`}>{card.label}</p>
                <p className="text-2xl md:text-3xl font-bold text-gray-900">
                  {formatKg(resumo[card.key])}
                  <span className="text-sm font-medium text-gray-500 ml-1">kg</span>
                </p>
                <p className="text-xs text-gray-500 mt-2">{card.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">🧮 Como o estoque é calculado</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
                📦 Em Estoque ({formatKg(resumo.inStock)} kg)
              </span>
              <span className="text-gray-400 font-bold">=</span>
              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium">
                ✅ Aproveitado ({formatKg(resumo.approved)})
              </span>
              <span className="text-gray-400 font-bold">+</span>
              <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium">
                🌾 Colheita ({formatKg(resumo.solidarityHarvest)})
              </span>
              <span className="text-gray-400 font-bold">−</span>
              <span className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-medium">
                📤 Distribuído ({formatKg(resumo.distributed)})
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              💡 Doações entram no estoque apenas após serem <strong>aproveitadas</strong>.
            </p>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="flex justify-between items-center border-b px-5 py-4 sticky top-0 bg-white rounded-t-xl z-10">
                <h3 className="text-lg font-bold text-gray-900">
                  ✅ Registrar Aproveitamento
                </h3>
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none disabled:opacity-50"
                >
                  ×
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center gap-2">
                  <span className="text-gray-500 text-sm">📅 Data:</span>
                  <span className="font-bold text-gray-900">
                    {preview ? formatDate(preview.date) : formatDate(getHojeLocal())}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">(hoje)</span>
                </div>

                {previewLoading && !preview && (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                  </div>
                )}

                {previewErro && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-red-700 text-sm">⚠️ {previewErro}</p>
                  </div>
                )}

                {preview && (
                  <>
                    {preview.existingApproval && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-amber-800 text-sm">
                          ⚠️ Já existe um aproveitamento registrado para hoje
                          (<strong>{formatKg(preview.existingApproval.approvedQuantity)} kg</strong>).
                          Salvar irá <strong>atualizar</strong> o registro existente.
                        </p>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">
                        🏪 Doações de hoje ({preview.donations.length})
                      </h4>
                      {preview.donations.length === 0 ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-gray-500 text-sm">
                          Nenhuma doação registrada hoje
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {preview.donations.map((d, idx) => (
                            <div key={`${d.donorId}-${idx}`} className="flex justify-between items-center bg-green-50 border border-green-100 rounded-lg px-3 py-2 text-sm">
                              <span className="text-green-700 font-medium truncate">{d.donorName}</span>
                              <span className="text-gray-700 font-semibold shrink-0 ml-2">{formatKg(d.quantity)} kg</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">🏪 Doações:</span>
                        <span className="font-semibold text-gray-900">{formatKg(preview.donationsTotal)} kg</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">🌾 Colheita Solidária:</span>
                        <span className="font-semibold text-gray-900">{formatKg(preview.harvestTotal)} kg</span>
                      </div>
                      <div className="flex justify-between text-base border-t border-blue-300 pt-1.5 mt-1.5">
                        <span className="text-blue-900 font-bold">📥 Total Recebido:</span>
                        <span className="font-bold text-blue-900">{formatKg(preview.totalReceived)} kg</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-semibold text-gray-700">
                          ✅ Quantidade Aproveitada (kg) *
                        </label>
                        {!showCalculadora && (
                          <button
                            type="button"
                            onClick={() => setShowCalculadora(true)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          >
                            🧮 Usar calculadora
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max={preview.totalReceived || undefined}
                        value={approvedQty}
                        onChange={(e) => setApprovedQty(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100"
                        placeholder="Ex: 95.5"
                        required
                        disabled={semDados}
                      />
                      {semDados ? (
                        <p className="text-xs text-amber-600 mt-1">
                          ⚠️ Não há nada para aproveitar hoje (sem doações ou colheita)
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">
                          💡 O valor aproveitado deve ser menor ou igual a {formatKg(preview.totalReceived)} kg
                        </p>
                      )}

                      {showCalculadora && (
                        <CalculadoraPeso
                          onApply={handleApplyCalc}
                          onClose={() => setShowCalculadora(false)}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        rows={2}
                        placeholder="Ex: 5kg de frutas descartadas por estarem estragadas..."
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="border-t px-5 py-4 flex flex-col sm:flex-row gap-2 sm:justify-end sticky bottom-0 bg-white rounded-b-xl">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={salvando}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2.5 rounded-lg font-medium transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando || !preview || semDados}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {salvando ? 'Salvando...' : preview?.existingApproval ? 'Atualizar Aproveitamento' : 'Registrar Aproveitamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { usePermissions } from '@/hooks/usePermissions'
import { useApi } from '@/hooks/useApi'
import CalculadoraPeso from '@/components/CalculadoraPeso'

interface EventoUnidade {
  unidade: string
  arrecadado: number
  distribuido: number
  saldo: number
}

interface EstoqueResumo {
  // 📊 Totais globais (histórico completo) — alimentam os cards de cima
  donations: number
  solidarityHarvest: number
  approved: number
  distributed: number

  // 🔐 Campos SENSÍVEIS — omitidos pelo backend para visualizador
  inStock?: number
  hasMarker?: boolean
  baseMarker?: {
    id: string
    type: 'ZERO' | 'ADJUSTMENT'
    date: string
    quantityKg: number
  } | null
  movementsSinceMarker?: {
    approvedKg: number
    harvestKg: number
    distributedKg: number
  }

  // 🆕 17-C — Gavetas de saldo separadas (kg) · SENSÍVEIS (omitidas na máscara)
  donationStockKg?: number
  harvestStockKg?: number

  // 🎪 Reservatório de eventos.
  // ⚠️ porUnidade / totalRecebimentos são SENSÍVEIS (omitidos na máscara).
  // ✅ totalArrecadadoGeral é AGREGADO e SEMPRE presente (inclusive p/ visualizador).
  eventos?: {
    porUnidade?: EventoUnidade[]
    totalRecebimentos?: number
    totalArrecadadoGeral?: number
  }
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
  key: keyof Pick<
    EstoqueResumo,
    'donations' | 'solidarityHarvest' | 'approved' | 'distributed' | 'inStock'
  >
  label: string
  emoji: string
  description: string
  bgColor: string
  borderColor: string
  textColor: string
  iconBg: string
  sensivel?: boolean // 🔐 oculto para visualizador
}

const CARDS: CardConfig[] = [
  { key: 'donations', label: 'Doações', emoji: '🏪', description: 'Total recebido em doações', bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700', iconBg: 'bg-green-100' },
  { key: 'solidarityHarvest', label: 'Colheita Solidária', emoji: '🌾', description: 'Total da colheita solidária', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', textColor: 'text-amber-700', iconBg: 'bg-amber-100' },
  { key: 'approved', label: 'Aproveitado', emoji: '✅', description: 'Total aproveitado das doações', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700', iconBg: 'bg-blue-100' },
  { key: 'distributed', label: 'Distribuído', emoji: '📤', description: 'Total distribuído aos beneficiários', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700', iconBg: 'bg-purple-100' },
  { key: 'inStock', label: 'Em Estoque', emoji: '📦', description: 'Saldo atual disponível', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300', textColor: 'text-emerald-700', iconBg: 'bg-emerald-100', sensivel: true },
]

const UNIDADE_LABEL: Record<string, string> = {
  kg: 'kg',
  g: 'g',
  l: 'L',
  ml: 'mL',
  un: 'un',
  cx: 'cx',
  pct: 'pct',
  fardo: 'fardo',
}

const formatUnidadeLabel = (u: string) => {
  const key = (u || 'un').trim().toLowerCase()
  return UNIDADE_LABEL[key] ?? key
}

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

const formatQtd = (valor: number | null | undefined) => {
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
    dedupingInterval: 5_000,
  })

  const erro = erroResumo ? 'Falha ao carregar resumo do estoque' : null

  const [showModal, setShowModal] = useState(false)
  const [previewKey, setPreviewKey] = useState<string | null>(null)
  const [approvedQty, setApprovedQty] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [showCalculadora, setShowCalculadora] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const {
    data: preview,
    error: erroPreview,
    isLoading: previewLoading,
  } = useApi<PreviewData>(previewKey, {
    dedupingInterval: 0,
    revalidateOnFocus: false,
    onSuccess: (data) => {
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
      mutateResumo()
    } catch (err) {
      console.error('Erro ao salvar:', err)
      alert(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const totalReceived = preview?.totalReceived ?? 0
  const semDados = preview !== undefined && preview !== null && totalReceived === 0

  // 🔐 FLAG DE MÁSCARA — backend omite inStock para visualizador
  const dadosMascarados = resumo ? resumo.inStock === undefined : false

  // 🛡️ Alerta de estoque negativo (só faz sentido quando NÃO mascarado)
  const estoqueNegativo =
    resumo && !dadosMascarados && typeof resumo.inStock === 'number'
      ? resumo.inStock < 0
      : false

  // 🎯 Dados do marco
  const temMarco = resumo?.hasMarker ?? false
  const marcoKg = resumo?.baseMarker?.quantityKg ?? 0
  const marcoData = resumo?.baseMarker?.date ?? null
  const marcoTipo = resumo?.baseMarker?.type ?? null
  const aprovDesde = resumo?.movementsSinceMarker?.approvedKg ?? 0
  const colhDesde = resumo?.movementsSinceMarker?.harvestKg ?? 0
  const distrDesde = resumo?.movementsSinceMarker?.distributedKg ?? 0

  // 🆕 17-C — Saldos por gaveta
  const saldoDoacaoKg = temMarco ? resumo?.donationStockKg ?? 0 : 0
  const saldoColheitaKg = temMarco ? resumo?.harvestStockKg ?? 0 : 0
  const saldoEstoqueGeralKg = saldoDoacaoKg + saldoColheitaKg

  // 🎪 Eventos detalhados (porUnidade — omitido na máscara)
  const eventos = resumo?.eventos?.porUnidade ?? []
  const temEventos = eventos.length > 0

  // 🆕 Total geral arrecadado em eventos (AGREGADO — visível p/ TODOS).
  // Backend envia sempre; fallback soma porUnidade quando não mascarado.
  const totalArrecadadoEventos =
    resumo?.eventos?.totalArrecadadoGeral ??
    (temEventos ? eventos.reduce((acc, ev) => acc + (ev.arrecadado || 0), 0) : 0)

  // 🔐 Cards visíveis conforme máscara
  const cardsVisiveis = CARDS.filter((c) => !(c.sensivel && dadosMascarados))
  const gridColsClass = dadosMascarados ? 'lg:grid-cols-4' : 'lg:grid-cols-5'

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
          {/* Cards principais */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridColsClass} gap-4 mb-6`}>
            {cardsVisiveis.map((card) => (
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

          {/* 🎪 Card SIMPLES — só visualizador (sem detalhe por unidade) */}
{dadosMascarados && (
  <div className="bg-rose-50 border-2 border-rose-200 rounded-xl p-5 shadow-sm mb-6">
    <div className="bg-rose-100 w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-3">
      🎪
    </div>
    <p className="text-sm font-semibold text-rose-700 mb-1">
      Total de alimentos arrecadados em eventos
    </p>
    <p className="text-2xl md:text-3xl font-bold text-gray-900">
      {formatQtd(totalArrecadadoEventos)}
    </p>
    <p className="text-xs text-gray-500 mt-2">
      ℹ️ Este total engloba <strong>todas as unidades de medida</strong> (kg, un, dz, L…).
      Para o detalhamento por unidade, procure um funcionário responsável.
    </p>
  </div>
)}

          {/* 🆕 17-C — Card ÚNICO "Estoque Geral" — oculto na máscara */}
          {!dadosMascarados && (
            <div className="bg-white border-2 border-teal-200 rounded-xl p-5 shadow-sm mb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-teal-100 w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0">
                    🗄️
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-teal-700">Estoque Geral</p>
                    <p className="text-xs text-gray-500">Saldo consolidado por origem — em kg</p>
                  </div>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-gray-900 shrink-0">
                  {formatKg(saldoEstoqueGeralKg)}
                  <span className="text-sm font-medium text-gray-500 ml-1">kg</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      🥫 Doações
                    </span>
                    <span className={`text-lg font-bold ${saldoDoacaoKg < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {formatKg(saldoDoacaoKg)} <span className="text-xs text-gray-500">kg</span>
                    </span>
                  </div>
                </div>

                <div className="bg-lime-50 border border-lime-100 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      🌾 Colheita Solidária
                    </span>
                    <span className={`text-lg font-bold ${saldoColheitaKg < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {formatKg(saldoColheitaKg)} <span className="text-xs text-gray-500">kg</span>
                    </span>
                  </div>
                </div>
              </div>

              {!temMarco && (
                <p className="text-xs text-amber-600 mt-4">
                  ⚠️ Sem <strong>Marco de calibração</strong> ainda. Os saldos permanecem em
                  0 kg até a pesagem física. Depois do marco, cada colheita registrada soma na
                  gaveta Colheita e cada distribuição desconta da gaveta escolhida (Doações ou
                  Colheita) — igual à lógica dos eventos.
                </p>
              )}
            </div>
          )}

          {/* 🔐 Aviso discreto para visualizador */}
          {dadosMascarados && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
              <p className="text-slate-600 text-sm">
                🔒 O saldo em estoque e os dados de calibração não estão disponíveis
                no seu nível de acesso. Os totais históricos acima permanecem visíveis.
              </p>
            </div>
          )}

          {/* 🎪 Card DETALHADO — operador/adm/dev, agora com total no cabeçalho */}
{!dadosMascarados && temEventos && (
  <div className="bg-white border-2 border-rose-200 rounded-xl p-5 shadow-sm mb-6">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className="bg-rose-100 w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0">
          🎪
        </div>
        <div>
          <p className="text-sm font-semibold text-rose-700">
            Total Arrecadado de Eventos
          </p>
          <p className="text-xs text-gray-500">
            Saldo por unidade — controlado à parte do estoque em kg
          </p>
        </div>
      </div>
      {/* 🆕 total agregado no canto direito */}
      <div className="text-right shrink-0">
        <p className="text-2xl md:text-3xl font-bold text-gray-900">
          {formatQtd(totalArrecadadoEventos)}
        </p>
        <p className="text-xs text-gray-500">total arrecadado</p>
      </div>
    </div>

    {/* ...resto igual (grid de eventos + rodapé ℹ️) */}


              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {eventos.map((ev) => (
                  <div key={ev.unidade} className="bg-rose-50 border border-rose-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                        {formatUnidadeLabel(ev.unidade)}
                      </span>
                      <span className={`text-lg font-bold ${ev.saldo < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {formatQtd(ev.saldo)}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-gray-500">
                      <div className="flex justify-between">
                        <span>📥 Arrecadado</span>
                        <span className="font-medium text-gray-700">{formatQtd(ev.arrecadado)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>📤 Distribuído</span>
                        <span className="font-medium text-gray-700">{formatQtd(ev.distribuido)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400 mt-4">
                ℹ️ Itens arrecadados em eventos são controlados por{' '}
                <strong>unidade própria</strong> (un, cx, L…) e não entram no saldo em kg
                do estoque geral.
              </p>
            </div>
          )}

          {/* 🛡️ Alerta de estoque negativo — ⬇️ AGORA abaixo dos eventos e acima do cálculo */}
          {estoqueNegativo && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700 font-semibold text-sm">
                ⚠️ Estoque negativo detectado ({formatKg(resumo.inStock)} kg)
              </p>
              <p className="text-red-600 text-xs mt-1">
                As saídas desde o marco superaram as entradas.
                Isso indica uma possível inconsistência nos dados (distribuição lançada sem
                aproveitamento correspondente) ou a necessidade de uma nova recalibração do estoque.
                Recomenda-se conferir os registros.
              </p>
            </div>
          )}

          {/* 🧮 Como o estoque é calculado — oculto na máscara */}
          {!dadosMascarados && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">🧮 Como o estoque é calculado</h3>

              {temMarco ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-medium">
                      📦 Em Estoque ({formatKg(resumo.inStock)} kg)
                    </span>
                    <span className="text-gray-400 font-bold">=</span>
                    <span className="px-3 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium">
                      🎯 Marco ({formatKg(marcoKg)})
                    </span>
                    <span className="text-gray-400 font-bold">+</span>
                    <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-medium">
                      ✅ Aprov. desde ({formatKg(aprovDesde)})
                    </span>
                    <span className="text-gray-400 font-bold">+</span>
                    <span className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium">
                      🌾 Colheita desde ({formatKg(colhDesde)})
                    </span>
                    <span className="text-gray-400 font-bold">−</span>
                    <span className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-medium">
                      📤 Distrib. desde ({formatKg(distrDesde)})
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mt-3">
                    💡 O saldo parte do{' '}
                    <strong>
                      {marcoTipo === 'ADJUSTMENT' ? 'último ajuste' : 'Marco Zero'}
                      {marcoData ? ` (${formatDate(marcoData)})` : ''}
                    </strong>{' '}
                    — uma pesagem física que calibra o estoque oficial. A partir dele, somam-se as{' '}
                    <strong>entradas</strong> (aproveitamento das doações + colheita realizada) e descontam-se as{' '}
                    <strong>saídas</strong> (distribuições). Movimentações registradas no mesmo dia do marco já estão
                    embutidas na pesagem e não são recontadas.
                  </p>

                  <p className="text-xs text-gray-400 mt-2">
                    ℹ️ Os cards acima (Doações, Colheita, Aproveitado, Distribuído) mostram o{' '}
                    <strong>histórico completo</strong> de registros — independente do marco.
                  </p>
                </>
              ) : (
                <>
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

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                    <p className="text-xs text-amber-700">
                      ⚠️ <strong>Nenhum Marco Zero cadastrado.</strong> O saldo está sendo calculado pelo
                      modelo legado (histórico completo). Crie um Marco Zero para calibrar o estoque
                      oficialmente a partir de uma pesagem física.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="flex justify-between items-center border-b px-5 py-4 sticky top-0 bg-white rounded-t-xl z-10">
                <h3 className="text-lg font-bold text-gray-900">✅ Registrar Aproveitamento</h3>
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
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Estoque *</label>
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
                        <CalculadoraPeso onApply={handleApplyCalc} onClose={() => setShowCalculadora(false)} />
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

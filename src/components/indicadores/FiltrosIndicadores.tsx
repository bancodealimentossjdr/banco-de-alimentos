'use client'

import { useEffect, useState } from 'react'
import MultiSelectChips, { type MultiSelectOption } from '@/components/ui/MultiSelectChips'

// ==========================================
// TIPOS
// ==========================================

export type FiltrosState = {
  from: string // ISO date (YYYY-MM-DD)
  to: string   // ISO date (YYYY-MM-DD)
  doadorIds: string[]
  produtorIds: string[]
  beneficiarioIds: string[]
  funcionarioIds: string[]
}

type OpcoesFiltro = {
  doadores: MultiSelectOption[]
  produtores: MultiSelectOption[]
  beneficiarios: MultiSelectOption[]
  funcionarios: MultiSelectOption[]
}

type Props = {
  onChange: (filtros: FiltrosState) => void
}

// ==========================================
// HELPERS DE DATA
// ==========================================

function isoHoje(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoDiasAtras(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

function isoMesesAtras(meses: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  return d.toISOString().slice(0, 10)
}

// ==========================================
// COMPONENTE
// ==========================================

export default function FiltrosIndicadores({ onChange }: Props) {
  // Estado interno do filtro (período + multiselects)
  // 🔧 Padrão: últimos 30 dias
  const [from, setFrom] = useState<string>(isoDiasAtras(30))
  const [to, setTo] = useState<string>(isoHoje())
  const [doadorIds, setDoadorIds] = useState<string[]>([])
  const [produtorIds, setProdutorIds] = useState<string[]>([])
  const [beneficiarioIds, setBeneficiarioIds] = useState<string[]>([])
  const [funcionarioIds, setFuncionarioIds] = useState<string[]>([])

  // Opções dos multiselects (carregadas 1x)
  const [opcoes, setOpcoes] = useState<OpcoesFiltro>({
    doadores: [],
    produtores: [],
    beneficiarios: [],
    funcionarios: [],
  })

  // Carrega opções (1x)
  useEffect(() => {
    fetch('/api/indicadores/filtros')
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setOpcoes(data)
      })
      .catch((err) => console.error('Erro ao carregar opções:', err))
  }, [])

  // Notifica o pai sempre que qualquer filtro mudar
  useEffect(() => {
    onChange({
      from,
      to,
      doadorIds,
      produtorIds,
      beneficiarioIds,
      funcionarioIds,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, doadorIds, produtorIds, beneficiarioIds, funcionarioIds])

  const totalFiltrosExtras =
    doadorIds.length +
    produtorIds.length +
    beneficiarioIds.length +
    funcionarioIds.length

  function clearExtras() {
    setDoadorIds([])
    setProdutorIds([])
    setBeneficiarioIds([])
    setFuncionarioIds([])
  }

  // Atalhos de período
  function setPeriodoDias(dias: number) {
    setFrom(isoDiasAtras(dias))
    setTo(isoHoje())
  }

  function setPeriodoMeses(meses: number) {
    setFrom(isoMesesAtras(meses))
    setTo(isoHoje())
  }

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* ===== Bloco 1: Período ===== */}
      <div className="mb-4">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
          📅 Período
          <span className="text-xs font-normal text-gray-500">
            (afeta todos os indicadores)
          </span>
        </h2>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
              max={isoHoje()}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Atalhos */}
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setPeriodoDias(7)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriodoDias(15)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              15 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriodoMeses(6)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              6 meses
            </button>
            <button
              type="button"
              onClick={() => setPeriodoMeses(12)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              1 ano
            </button>
          </div>
        </div>
      </div>

      {/* ===== Bloco 2: Filtros extras (afetam só o Top 5 — por enquanto) ===== */}
      <div className="border-t border-gray-100 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            🔎 Filtros adicionais
            {totalFiltrosExtras > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                {totalFiltrosExtras} ativo{totalFiltrosExtras !== 1 ? 's' : ''}
              </span>
            )}
            <span className="text-xs font-normal text-gray-500">
              (afetam apenas o Top 5 Funcionários)
            </span>
          </h2>
          {totalFiltrosExtras > 0 && (
            <button
              type="button"
              onClick={clearExtras}
              className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline"
            >
              Limpar adicionais
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MultiSelectChips
            label="Doadores"
            placeholder="Todos os doadores"
            options={opcoes.doadores}
            selectedIds={doadorIds}
            onChange={setDoadorIds}
          />
          <MultiSelectChips
            label="Produtores"
            placeholder="Todos os produtores"
            options={opcoes.produtores}
            selectedIds={produtorIds}
            onChange={setProdutorIds}
          />
          <MultiSelectChips
            label="Beneficiários"
            placeholder="Todos os beneficiários"
            options={opcoes.beneficiarios}
            selectedIds={beneficiarioIds}
            onChange={setBeneficiarioIds}
          />
          <MultiSelectChips
            label="Funcionários"
            placeholder="Todos os funcionários"
            options={opcoes.funcionarios}
            selectedIds={funcionarioIds}
            onChange={setFuncionarioIds}
          />
        </div>

        <p className="mt-3 text-xs text-gray-500">
          ℹ️ Filtros combinam por <strong>E</strong> entre categorias e{' '}
          <strong>OU</strong> dentro da mesma categoria. Para funcionários,
          considera-se sua presença em qualquer um dos 3 campos do registro.
        </p>
      </div>
    </section>
  )
}

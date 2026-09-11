// src/components/indicadores/FiltrosIndicadores.tsx
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  type FiltrosState,
  EMPTY_FILTROS,
  countFiltrosAtivos,
} from '@/lib/indicadores/filters'

export type { FiltrosState }

interface Opcao {
  id: string
  name: string
}

interface Opcoes {
  doadores: Opcao[]
  produtores: Opcao[]
  beneficiarios: Opcao[]
  funcionarios: Opcao[]
}

interface Props {
  /** 🔔 Disparado APENAS ao clicar em "Aplicar" (ou na carga inicial). */
  onChange: (f: FiltrosState) => void
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* ⏱️ Presets de janela retroativa (a partir de HOJE)                  */
/*    dias → janela inclusiva | meses → evita drift de 30/31 dias      */
/* ------------------------------------------------------------------ */
const PRESETS = [
  { key: '7d', label: '7 dias', dias: 7, meses: 0 },
  { key: '15d', label: '15 dias', dias: 15, meses: 0 },
  { key: '30d', label: '30 dias', dias: 30, meses: 0 },
  { key: '6m', label: '6 meses', dias: 0, meses: 6 },
  { key: '1a', label: '1 ano', dias: 0, meses: 12 },
] as const

type PresetKey = (typeof PRESETS)[number]['key']

const PRESET_DEFAULT: PresetKey = '30d'

function rangeDoPreset(key: PresetKey): { from: string; to: string } {
  const p = PRESETS.find((x) => x.key === key)!
  const hoje = new Date()
  const from = new Date(hoje)
  if (p.dias) from.setDate(from.getDate() - (p.dias - 1))
  else {
    from.setMonth(from.getMonth() - p.meses)
    from.setDate(from.getDate() + 1)
  }
  return { from: ymd(from), to: ymd(hoje) }
}

function defaultFiltros(): FiltrosState {
  // 📅 Default agora é "30 dias" — coerente com os presets.
  return { ...rangeDoPreset(PRESET_DEFAULT), ...EMPTY_FILTROS }
}

/* ================================================================== */
/* MultiSelect — dropdown com checkboxes, sem lib externa              */
/* ================================================================== */
function MultiSelect({
  label,
  emoji,
  opcoes,
  selecionados,
  onToggle,
  onClear,
}: {
  label: string
  emoji: string
  opcoes: Opcao[]
  selecionados: string[]
  onToggle: (id: string) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return opcoes
    return opcoes.filter((o) => o.name.toLowerCase().includes(q))
  }, [opcoes, busca])

  const resumo =
    selecionados.length === 0
      ? 'Todos'
      : selecionados.length === 1
        ? (opcoes.find((o) => o.id === selecionados[0])?.name ?? '1 selecionado')
        : `${selecionados.length} selecionados`

  return (
    <div className="relative" ref={ref}>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {emoji} {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition ${
          selecionados.length
            ? 'border-green-500 bg-green-50 font-medium text-green-800'
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
        }`}
      >
        <span className="truncate">{resumo}</span>
        <span className="shrink-0 text-xs text-gray-400">
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:border-green-500"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtradas.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-400">
                Nenhum resultado
              </p>
            )}
            {filtradas.map((o) => {
              const ativo = selecionados.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onToggle(o.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] text-white ${
                      ativo
                        ? 'border-green-600 bg-green-600'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {ativo && '✓'}
                  </span>
                  <span className="truncate text-gray-700">{o.name}</span>
                </button>
              )
            })}
          </div>

          {selecionados.length > 0 && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={onClear}
                className="w-full rounded-md py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              >
                Limpar seleção
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* Componente principal                                                */
/* ================================================================== */
export default function FiltrosIndicadores({ onChange }: Props) {
  // 📝 DRAFT: estado editável, não dispara requisição.
  const [draft, setDraft] = useState<FiltrosState>(defaultFiltros)
  // 🔒 APPLIED: último estado efetivamente enviado ao servidor.
  const [applied, setApplied] = useState<FiltrosState>(draft)
  const [presetAtivo, setPresetAtivo] = useState<PresetKey | null>(
    PRESET_DEFAULT,
  )

  const [opcoes, setOpcoes] = useState<Opcoes>({
    doadores: [],
    produtores: [],
    beneficiarios: [],
    funcionarios: [],
  })

  // Carga inicial: dispara UMA vez com o período default.
  const bootRef = useRef(false)
  useEffect(() => {
    if (bootRef.current) return
    bootRef.current = true
    onChange(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/indicadores/filtros', { signal: ac.signal })
      .then((r) => r.json())
      .then((d) =>
        setOpcoes({
          doadores: d.doadores ?? [],
          produtores: d.produtores ?? [],
          beneficiarios: d.beneficiarios ?? [],
          funcionarios: d.funcionarios ?? [],
        }),
      )
      .catch((e) => {
        if (e.name !== 'AbortError')
          console.error('Erro ao carregar opções de filtro:', e)
      })
    return () => ac.abort()
  }, [])

  const toggle = (campo: keyof FiltrosState, id: string) =>
    setDraft((p) => {
      const atual = p[campo] as string[]
      return {
        ...p,
        [campo]: atual.includes(id)
          ? atual.filter((x) => x !== id)
          : [...atual, id],
      }
    })

  const clear = (campo: keyof FiltrosState) =>
    setDraft((p) => ({ ...p, [campo]: [] }))

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(applied),
    [draft, applied],
  )

  const aplicar = () => {
    if (draft.from > draft.to) return
    setApplied(draft)
    onChange(draft)
  }

  const limpar = () => {
    const d = defaultFiltros()
    setDraft(d)
    setApplied(d)
    setPresetAtivo(PRESET_DEFAULT)
    onChange(d)
  }

  const aplicarPreset = (key: PresetKey) => {
    setPresetAtivo(key)
    setDraft((p) => ({ ...p, ...rangeDoPreset(key) }))
  }

  // ✍️ Editar a data manualmente desmarca o preset.
  const setData = (campo: 'from' | 'to', valor: string) => {
    setPresetAtivo(null)
    setDraft((p) => ({ ...p, [campo]: valor }))
  }

  const ativos = countFiltrosAtivos(draft)
  const dataInvalida = draft.from > draft.to

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          🔎 Filtros
          {ativos > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
              {ativos}
            </span>
          )}
        </h2>

        {/* 🎚️ Segmented control — visual de "pílulas" agrupadas */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
          {PRESETS.map((p) => {
            const ativo = presetAtivo === p.key
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => aplicarPreset(p.key)}
                aria-pressed={ativo}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  ativo
                    ? 'bg-white text-green-700 shadow-sm ring-1 ring-green-200'
                    : 'text-gray-500 hover:bg-white/60 hover:text-gray-700'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            📅 De
          </label>
          <input
            type="date"
            value={draft.from}
            max={draft.to}
            onChange={(e) => setData('from', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            📅 Até
          </label>
          <input
            type="date"
            value={draft.to}
            min={draft.from}
            onChange={(e) => setData('to', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-500"
          />
        </div>

        <MultiSelect
          label="Doadores"
          emoji="🏪"
          opcoes={opcoes.doadores}
          selecionados={draft.doadorIds}
          onToggle={(id) => toggle('doadorIds', id)}
          onClear={() => clear('doadorIds')}
        />
        <MultiSelect
          label="Produtores"
          emoji="🚜"
          opcoes={opcoes.produtores}
          selecionados={draft.produtorIds}
          onToggle={(id) => toggle('produtorIds', id)}
          onClear={() => clear('produtorIds')}
        />
        <MultiSelect
          label="Beneficiários"
          emoji="👥"
          opcoes={opcoes.beneficiarios}
          selecionados={draft.beneficiarioIds}
          onToggle={(id) => toggle('beneficiarioIds', id)}
          onClear={() => clear('beneficiarioIds')}
        />
        <MultiSelect
          label="Funcionários"
          emoji="🧑‍🌾"
          opcoes={opcoes.funcionarios}
          selecionados={draft.funcionarioIds}
          onToggle={(id) => toggle('funcionarioIds', id)}
          onClear={() => clear('funcionarioIds')}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500">
          {dataInvalida ? (
            <span className="font-medium text-red-600">
              ⚠️ A data inicial não pode ser maior que a final.
            </span>
          ) : dirty ? (
            <span className="font-medium text-amber-600">
              ● Alterações não aplicadas
            </span>
          ) : (
            'Filtros sincronizados com os dados exibidos.'
          )}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={limpar}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            ↺ Limpar
          </button>
          <button
            type="button"
            onClick={aplicar}
            disabled={dataInvalida || !dirty}
            className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            🔍 Aplicar filtros
          </button>
        </div>
      </div>
    </div>
  )
}

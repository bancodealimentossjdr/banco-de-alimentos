'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import CardIngressos from './CardIngressos'

// ==========================================
// Tipos
// ==========================================
type Local = { id: string; nome: string; endereco: string | null }
type Alimento = { id: string; nome: string; unidade: string }

type Props = {
  eventoId: string
  eventoNome: string
  locais: Local[]
  alimentos: Alimento[]
  isDev?: boolean // 🆕 controla botão "reverter retirada"
}

// ==========================================
// Config de unidade (B-turbo)
// ==========================================
type UnitConfig = {
  passos: number[]
  baseStep: number
  decimais: number
}

function getUnitConfig(unidadeRaw: string): UnitConfig {
  const u = unidadeRaw.trim().toLowerCase()
  const inteiras = ['un', 'und', 'unidade', 'unidades', 'cx', 'caixa', 'pç', 'pc', 'pacote', 'fardo', 'dz', 'duzia', 'dúzia']
  if (inteiras.includes(u)) {
    return { passos: [1, 10], baseStep: 1, decimais: 0 }
  }
  return { passos: [0.5, 1, 5], baseStep: 1, decimais: 1 }
}

function fix(value: number, decimais: number): number {
  const f = Math.pow(10, decimais)
  return Math.round(value * f) / f
}

function fmt(value: number, decimais: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais > 0 ? 1 : 0,
    maximumFractionDigits: decimais,
  })
}

// ==========================================
// Componente principal
// ==========================================
export default function CampoCliente({
  eventoId,
  eventoNome,
  locais,
  alimentos,
  isDev = false, // 🆕
}: Props) {
  const router = useRouter()

  const [localId, setLocalId] = useState<string>('')
  const [quantidades, setQuantidades] = useState<Record<string, number>>({})
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const localSelecionado = locais.find((l) => l.id === localId) ?? null

  const itensComQtd = useMemo(
    () =>
      alimentos
        .map((a) => ({
          alimento: a,
          quantidade: quantidades[a.id] ?? 0,
        }))
        .filter((i) => i.quantidade > 0),
    [alimentos, quantidades],
  )

  const temAlgoParaSalvar = itensComQtd.length > 0

  function voltarAoEvento() {
    if (temAlgoParaSalvar) {
      const ok = window.confirm('Você tem quantidades não salvas. Sair mesmo assim?')
      if (!ok) return
    }
    router.push(`/eventos/${eventoId}`)
  }

  function setQtd(alimentoId: string, novo: number, decimais: number) {
    const limpo = Math.max(0, fix(novo, decimais))
    setQuantidades((prev) => ({ ...prev, [alimentoId]: limpo }))
  }

  function ajustar(alimentoId: string, delta: number, decimais: number) {
    const atual = quantidades[alimentoId] ?? 0
    setQtd(alimentoId, atual + delta, decimais)
  }

  function trocarLocal(novoId: string) {
    if (temAlgoParaSalvar && novoId !== localId) {
      const ok = window.confirm('Trocar de local vai apagar as quantidades não salvas. Continuar?')
      if (!ok) return
    }
    setLocalId(novoId)
    setQuantidades({})
  }

  function pedirConfirmacao() {
    if (!localId) {
      toast.error('Escolha um local primeiro.')
      return
    }
    if (!temAlgoParaSalvar) {
      toast.error('Nenhuma quantidade maior que zero para registrar.')
      return
    }
    setConfirmando(true)
  }

  async function salvar() {
    setSalvando(true)
    setConfirmando(false)

    const payload = {
      localId,
      itens: itensComQtd.map((i) => ({
        alimentoId: i.alimento.id,
        quantidade: i.quantidade,
      })),
    }

    try {
      const res = await fetch(`/api/eventos/${eventoId}/recebimentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data?.error ?? 'Erro ao registrar recebimentos.')
        return
      }

      toast.success(`${data.registrados} recebimento(s) registrado(s)! ✅`)
      setQuantidades({})
      router.refresh()
    } catch {
      toast.error('Falha de conexão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ==========================================
  // Render
  // ==========================================
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Cabeçalho */}
      <header className="mb-6">
        <button
          type="button"
          onClick={voltarAoEvento}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-green-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
          Voltar ao evento
        </button>

        <p className="text-sm text-gray-500">Registro de campo</p>
        <h1 className="text-2xl font-bold text-gray-900">{eventoNome}</h1>
      </header>

      {/* Passo 1 — escolher local */}
      <section className="mb-6">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          1. Local de coleta
        </label>
        <select
          value={localId}
          onChange={(e) => trocarLocal(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-green-500 focus:ring-green-500"
        >
          <option value="">— Selecione o local —</option>
          {locais.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
        {locais.length === 0 && (
          <p className="mt-2 text-sm text-red-600">
            Este evento ainda não tem locais cadastrados.
          </p>
        )}
      </section>

      {/* 🎫 Card de ingressos — busca CPF por dentro (Onda 18) */}
      {localSelecionado && (
        <section className="mb-6">
          <CardIngressos isDev={isDev} />
        </section>
      )}

      {/* Passo 2 — quantidades */}
      {localSelecionado && (
        <section className="mb-24">
          <h2 className="mb-3 text-sm font-medium text-gray-700">
            2. Quantidades recebidas
          </h2>

          {alimentos.length === 0 && (
            <p className="text-sm text-red-600">
              Nenhum alimento cadastrado neste evento.
            </p>
          )}

          <div className="space-y-3">
            {alimentos.map((a) => {
              const cfg = getUnitConfig(a.unidade)
              const valor = quantidades[a.id] ?? 0
              const ativo = valor > 0

              return (
                <div
                  key={a.id}
                  className={`rounded-xl border p-4 transition ${
                    ativo ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="mb-3 flex items-baseline justify-between">
                    <span className="font-medium text-gray-900">{a.nome}</span>
                    <span className="text-xs uppercase text-gray-400">{a.unidade}</span>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => ajustar(a.id, -cfg.baseStep, cfg.decimais)}
                      className="h-12 w-12 rounded-full bg-gray-200 text-2xl font-bold text-gray-700 active:scale-95"
                      aria-label="Diminuir"
                    >
                      −
                    </button>

                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={cfg.decimais > 0 ? 0.1 : 1}
                      value={valor === 0 ? '' : valor}
                      placeholder="0"
                      onChange={(e) =>
                        setQtd(
                          a.id,
                          e.target.value === '' ? 0 : Number(e.target.value),
                          cfg.decimais,
                        )
                      }
                      className="w-24 rounded-lg border border-gray-300 py-2 text-center text-2xl font-bold focus:border-green-500 focus:ring-green-500"
                    />

                    <button
                      type="button"
                      onClick={() => ajustar(a.id, cfg.baseStep, cfg.decimais)}
                      className="h-12 w-12 rounded-full bg-green-600 text-2xl font-bold text-white active:scale-95"
                      aria-label="Aumentar"
                    >
                      +
                    </button>
                  </div>

                  <div className="mt-3 flex justify-center gap-2">
                    {cfg.passos.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => ajustar(a.id, p, cfg.decimais)}
                        className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200 active:scale-95"
                      >
                        +{fmt(p, cfg.decimais)}
                      </button>
                    ))}
                    {ativo && (
                      <button
                        type="button"
                        onClick={() => setQtd(a.id, 0, cfg.decimais)}
                        className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-100 active:scale-95"
                      >
                        zerar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Barra fixa de salvar */}
      {localSelecionado && alimentos.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <span className="text-sm text-gray-600">
              {temAlgoParaSalvar
                ? `${itensComQtd.length} alimento(s) com quantidade`
                : 'Ajuste as quantidades'}
            </span>
            <button
              type="button"
              onClick={pedirConfirmacao}
              disabled={!temAlgoParaSalvar || salvando}
              className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-40"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmação */}
      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-lg font-bold text-gray-900">Confirmar registro</h3>
            <p className="mb-4 text-sm text-gray-500">
              Local: <span className="font-medium">{localSelecionado?.nome}</span>
            </p>

            <ul className="mb-6 max-h-64 space-y-2 overflow-y-auto">
              {itensComQtd.map((i) => {
                const cfg = getUnitConfig(i.alimento.unidade)
                return (
                  <li
                    key={i.alimento.id}
                    className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm"
                  >
                    <span className="text-gray-700">{i.alimento.nome}</span>
                    <span className="font-semibold text-gray-900">
                      {fmt(i.quantidade, cfg.decimais)} {i.alimento.unidade}
                    </span>
                  </li>
                )
              })}
            </ul>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="flex-1 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="flex-1 rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

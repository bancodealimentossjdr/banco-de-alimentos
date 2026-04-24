'use client'
import { useState } from 'react'
import { PESO_CAIXA_KG } from '@/lib/constants'

interface Pesagem {
  boxes: number
  weight: number
}

interface CalculadoraPesoProps {
  /** Callback quando o usuário clica em "Aplicar peso" */
  onApply: (pesoLiquido: number, totalCaixas: number) => void
  /** Callback quando o usuário fecha a calculadora (X) */
  onClose: () => void
  /** Tara por caixa em kg. Default: PESO_CAIXA_KG (2 kg) */
  taraPorCaixa?: number
}

/**
 * 🧮 Calculadora de Peso reutilizável
 * 
 * Permite registrar múltiplas pesagens (nº de caixas + peso bruto)
 * e calcula automaticamente o peso líquido descontando a tara.
 * 
 * Usada em: Doações, Distribuições, Colheita Solidária.
 */
export default function CalculadoraPeso({
  onApply,
  onClose,
  taraPorCaixa = PESO_CAIXA_KG,
}: CalculadoraPesoProps) {
  const [pesagens, setPesagens] = useState<Pesagem[]>([
    { boxes: 0, weight: 0 },
  ])

  const addPesagem = () =>
    setPesagens([...pesagens, { boxes: 0, weight: 0 }])

  const removePesagem = (i: number) => {
    if (pesagens.length > 1) {
      setPesagens(pesagens.filter((_, idx) => idx !== i))
    }
  }

  const updatePesagem = (
    i: number,
    field: 'boxes' | 'weight',
    value: number
  ) => {
    const updated = [...pesagens]
    updated[i] = { ...updated[i], [field]: value }
    setPesagens(updated)
  }

  // 🧮 Cálculos
  const totalBoxes = pesagens.reduce((sum, p) => sum + (p.boxes || 0), 0)
  const totalBruto = pesagens.reduce((sum, p) => sum + (p.weight || 0), 0)
  const totalTara = totalBoxes * taraPorCaixa
  const totalLiquido = Math.max(0, totalBruto - totalTara)

  const handleApply = () => {
    if (totalBoxes <= 0) {
      alert('Informe o número de caixas em pelo menos uma pesagem.')
      return
    }
    onApply(parseFloat(totalLiquido.toFixed(2)), totalBoxes)
  }

  return (
    <div className="mt-2 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-semibold text-blue-700">
          🧮 Calculadora de Peso
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          ✕
        </button>
      </div>

      <p className="text-xs text-blue-500 mb-3">
        Informe o número de caixas e o peso bruto de cada pesagem. A tara
        ({taraPorCaixa} kg por caixa) será descontada automaticamente.
      </p>

      {/* Lista de pesagens */}
      <div className="space-y-2 mb-3">
        {pesagens.map((p, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <span className="text-xs font-medium text-blue-400 w-6 text-center hidden sm:block">
              {i + 1}.
            </span>

            {/* Caixas */}
            <div className="relative flex-1 sm:w-28 sm:flex-none">
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                step="1"
                placeholder="Caixas"
                value={p.boxes || ''}
                onChange={(e) =>
                  updatePesagem(i, 'boxes', parseInt(e.target.value) || 0)
                }
                className="w-full border rounded px-3 py-2 text-sm pr-10 bg-white"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                cx
              </span>
            </div>

            {/* Peso bruto */}
            <div className="flex gap-2 items-center flex-1">
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="Peso bruto"
                  value={p.weight || ''}
                  onChange={(e) =>
                    updatePesagem(i, 'weight', parseFloat(e.target.value) || 0)
                  }
                  className="w-full border rounded px-3 py-2 text-sm pr-8 bg-white"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  kg
                </span>
              </div>
              {pesagens.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePesagem(i)}
                  className="shrink-0 text-red-400 hover:text-red-600 p-1"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPesagem}
        className="text-blue-600 hover:text-blue-700 text-xs font-medium mb-3 block"
      >
        + Adicionar pesagem
      </button>

      {/* Resumo */}
      <div className="bg-white rounded-lg px-4 py-3 border border-blue-200 mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Total de caixas:</span>
          <span className="font-semibold text-gray-800">{totalBoxes}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Peso bruto:</span>
          <span className="text-gray-800">{totalBruto.toFixed(2)} kg</span>
        </div>
        <div className="flex justify-between text-sm mb-2 text-red-600">
          <span>
            Tara ({totalBoxes} × {taraPorCaixa} kg):
          </span>
          <span>−{totalTara.toFixed(2)} kg</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-blue-100">
          <span className="text-sm font-bold text-blue-700">
            🏷️ Peso líquido:
          </span>
          <span className="text-lg font-bold text-blue-700">
            {totalLiquido.toFixed(2)} kg
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleApply}
        disabled={totalBoxes <= 0 || totalLiquido <= 0}
        className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition w-full sm:w-auto"
      >
        Aplicar peso
      </button>
    </div>
  )
}

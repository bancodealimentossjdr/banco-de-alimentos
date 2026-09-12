'use client'

/**
 * 👁️ ONDA 23.7e-3 — modal de ocultação, compartilhado pelos 4 cadastros
 * (produtores, funcionários, doadores, beneficiários).
 *
 * Nota obrigatória com mín. 5 caracteres — mesma regra validada no servidor.
 * Reexibir NÃO passa por aqui (é ação direta, sem justificativa).
 */
type Props = {
  nome: string
  label: string          // 'funcionário' | 'doador' | 'instituição'
  nota: string
  onNotaChange: (v: string) => void
  onConfirmar: () => void
  onCancelar: () => void
  enviando: boolean
}

export default function ModalOcultar({
  nome,
  label,
  nota,
  onNotaChange,
  onConfirmar,
  onCancelar,
  enviando,
}: Props) {
  const notaValida = nota.trim().length >= 5

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-1">🚫 Ocultar {label}</h3>
        <p className="text-sm text-gray-600 mb-4">
          <strong>{nome}</strong> deixará de aparecer em listagens e formulários dos outros
          usuários. Todos os indicadores, extratos e exports permanecem{' '}
          <strong>inalterados</strong>.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Motivo * <span className="text-xs text-gray-400">(mín. 5 caracteres)</span>
        </label>
        <textarea
          value={nota}
          onChange={(e) => onNotaChange(e.target.value)}
          rows={3}
          autoFocus
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="Ex: cadastro duplicado, aguardando conferência"
        />

        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!notaValida || enviando}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg font-medium transition"
          >
            {enviando ? 'Ocultando...' : 'Confirmar'}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-medium transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

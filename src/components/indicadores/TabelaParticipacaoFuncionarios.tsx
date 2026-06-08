'use client'

import type { FuncionarioParticipacao } from '@/lib/data/indicadores-data'

type Props = {
  dados: FuncionarioParticipacao[]
  loading?: boolean
}

export default function TabelaParticipacaoFuncionarios({ dados, loading }: Props) {
  return (
    <section className="mt-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-3">
        <h3 className="text-base font-bold text-gray-800">
          📋 Participação Detalhada
        </h3>
        <p className="text-xs text-gray-500">
          Detalhamento por tipo de evento dos funcionários filtrados.
        </p>
      </header>

      {loading ? (
        <div className="h-32 animate-pulse rounded bg-gray-100" />
      ) : dados.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          Nenhum dado pra exibir.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-medium">Funcionário</th>
                <th className="py-2 px-3 text-right font-medium">Kg envolvidos</th>
                <th className="py-2 px-3 text-right font-medium">Doações</th>
                <th className="py-2 px-3 text-right font-medium">Distribuições</th>
                <th className="py-2 px-3 text-right font-medium">Colheitas</th>
                <th className="py-2 pl-3 text-right font-medium">Total eventos</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((f) => (
                <tr
                  key={f.funcionarioId}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-2 pr-3">
                    <p className="font-medium text-gray-800">{f.funcionarioNome}</p>
                    {f.funcionarioRole && (
                      <p className="text-xs text-gray-500">{f.funcionarioRole}</p>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-900">
                    {f.kgEnvolvido.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-700">{f.numDoacoes}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{f.numDistribuicoes}</td>
                  <td className="py-2 px-3 text-right text-gray-700">{f.numColheitas}</td>
                  <td className="py-2 pl-3 text-right font-bold text-gray-900">
                    {f.numEventos}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

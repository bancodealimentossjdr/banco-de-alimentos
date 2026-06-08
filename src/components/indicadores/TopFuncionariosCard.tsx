'use client'

import type { FuncionarioParticipacao } from '@/lib/data/indicadores-data'

type Props = {
  dados: FuncionarioParticipacao[]
  loading?: boolean
}

export default function TopFuncionariosCard({ dados, loading }: Props) {
  const top5 = dados.slice(0, 5)

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            🏆 Top 5 Funcionários
          </h2>
          <p className="text-xs text-gray-500">
            Por kg envolvidos em eventos (doações + distribuições + colheitas)
          </p>
        </div>
        <span
          className="cursor-help text-xs text-gray-400"
          title="Kg envolvido = soma dos eventos em que o funcionário participou. Não representa contribuição individual exata — o mesmo evento pode contar para até 3 funcionários."
        >
          ℹ️ Como contamos?
        </span>
      </header>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ) : top5.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">
          Nenhum funcionário com participação no período/filtros selecionados.
        </p>
      ) : (
        <ol className="space-y-2">
          {top5.map((f, idx) => {
            const medal = ['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}º`
            const maxKg = top5[0].kgEnvolvido || 1
            const pct = (f.kgEnvolvido / maxKg) * 100

            return (
              <li
                key={f.funcionarioId}
                className="rounded-md border border-gray-100 bg-gray-50 p-3"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{medal}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{f.funcionarioNome}</p>
                      {f.funcionarioRole && (
                        <p className="text-xs text-gray-500">{f.funcionarioRole}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {f.kgEnvolvido.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                    </p>
                    <p className="text-xs text-gray-500">
                      {f.numEventos} evento{f.numEventos !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

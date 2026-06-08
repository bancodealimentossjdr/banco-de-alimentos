'use client';

import { useState, useEffect } from 'react';
import FiltrosIndicadores, {
  type FiltrosState,
} from '@/components/indicadores/FiltrosIndicadores';
import KpiCard from '@/components/indicadores/KpiCard';
import GraficoTendencia, {
  SerieData,
} from '@/components/indicadores/GraficoTendencia';
import GraficoPizza from '@/components/indicadores/GraficoPizza';
import GraficoBarras from '@/components/indicadores/GraficoBarras';
import BotoesExportacao from '@/components/indicadores/BotoesExportacao';
import TopFuncionariosCard from '@/components/indicadores/TopFuncionariosCard';
import TabelaParticipacaoFuncionarios from '@/components/indicadores/TabelaParticipacaoFuncionarios';
import type { FuncionarioParticipacao } from '@/lib/data/indicadores-data';
import { useDebounce } from '@/hooks/useDebounce';

interface Macro {
  totalDoado: number;
  totalDistribuido: number;
  totalColheita: number;
  emEstoque: number;
  percentualAproveitamento: number;
  beneficiariosAtendidos: number;
}

export default function IndicadoresPage() {
  // ============================================
  // Estado unificado de filtros
  // ============================================
  const [filters, setFilters] = useState<FiltrosState | null>(null);

  // ============================================
  // Estados dos indicadores antigos
  // ============================================
  const [macro, setMacro] = useState<Macro | null>(null);
  const [tendencia, setTendencia] = useState<SerieData | null>(null);
  const [topProdutos, setTopProdutos] = useState<any[]>([]);
  const [topDoadores, setTopDoadores] = useState<any[]>([]);
  const [topBeneficiarios, setTopBeneficiarios] = useState<any[]>([]);
  const [topProdutores, setTopProdutores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ============================================
  // Estados do Top 5 funcionários (novo)
  // ============================================
  const [participacao, setParticipacao] = useState<FuncionarioParticipacao[]>([]);
  const [loadingPart, setLoadingPart] = useState(false);

  // Debounce só dos filtros que afetam o Top 5
  const filtersDebounced = useDebounce(filters, 350);

  // ============================================
  // Carrega KPIs/gráficos antigos (usa from/to)
  // ============================================
  useEffect(() => {
    if (!filters) return;
    setLoading(true);

    const qs = `from=${filters.from}&to=${filters.to}`;

    Promise.all([
      fetch(`/api/indicadores/macro?${qs}`).then((r) => r.json()),
      fetch(`/api/indicadores/aproveitamento?${qs}&serie=true`).then((r) =>
        r.json()
      ),
      fetch(`/api/indicadores/rankings?${qs}&type=produtos`).then((r) =>
        r.json()
      ),
      fetch(`/api/indicadores/rankings?${qs}&type=doadores`).then((r) =>
        r.json()
      ),
      fetch(`/api/indicadores/rankings?${qs}&type=beneficiarios`).then((r) =>
        r.json()
      ),
      fetch(`/api/indicadores/rankings?${qs}&type=produtores`).then((r) =>
        r.json()
      ),
    ])
      .then(([m, serie, p, d, b, pr]) => {
        setMacro(m);
        setTendencia(
          serie && Array.isArray(serie.points) ? (serie as SerieData) : null
        );
        setTopProdutos(Array.isArray(p) ? p : []);
        setTopDoadores(Array.isArray(d) ? d : []);
        setTopBeneficiarios(Array.isArray(b) ? b : []);
        setTopProdutores(Array.isArray(pr) ? pr : []);
      })
      .catch((e) => console.error('Erro ao carregar indicadores:', e))
      .finally(() => setLoading(false));
    // 🔑 Só reage a from/to — multiselects NÃO afetam os antigos (Opção A)
  }, [filters?.from, filters?.to]);

  // ============================================
  // Carrega Top 5 funcionários (usa TODOS os filtros)
  // ============================================
  useEffect(() => {
    if (!filtersDebounced) return;

    const params = new URLSearchParams();
    params.set('from', filtersDebounced.from);
    params.set('to', filtersDebounced.to);
    if (filtersDebounced.doadorIds.length)
      params.set('doadorIds', filtersDebounced.doadorIds.join(','));
    if (filtersDebounced.produtorIds.length)
      params.set('produtorIds', filtersDebounced.produtorIds.join(','));
    if (filtersDebounced.beneficiarioIds.length)
      params.set('beneficiarioIds', filtersDebounced.beneficiarioIds.join(','));
    if (filtersDebounced.funcionarioIds.length)
      params.set('funcionarioIds', filtersDebounced.funcionarioIds.join(','));

    setLoadingPart(true);
    fetch(`/api/indicadores/participacao-funcionarios?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setParticipacao(data);
      })
      .catch((err) => console.error('Erro ao buscar participação:', err))
      .finally(() => setLoadingPart(false));
  }, [filtersDebounced]);

  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  // Deriva o filtro de exportação ({ from, to }) a partir do estado unificado
  const exportFilters = filters
    ? { from: filters.from, to: filters.to }
    : null;

  // Mostra tabela detalhada só quando há funcionários filtrados
  const mostrarTabelaDetalhada =
    (filters?.funcionarioIds.length ?? 0) > 0;

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Indicadores</h1>
          <p className="text-gray-600 mt-1">
            Visão geral da operação do Banco de Alimentos
          </p>
        </div>
        <BotoesExportacao filters={exportFilters} />
      </div>

      <FiltrosIndicadores onChange={setFilters} />

      {loading && (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      )}

      {macro && !loading && (
        <>
          {/* ===== KPIs ===== */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <KpiCard
              label="Total Doado"
              value={fmt(macro.totalDoado)}
              unit="kg"
              emoji="🏪"
            />
            <KpiCard
              label="Distribuído"
              value={fmt(macro.totalDistribuido)}
              unit="kg"
              emoji="📤"
            />
            <KpiCard
              label="Colheita"
              value={fmt(macro.totalColheita)}
              unit="kg"
              emoji="🌾"
            />
            <KpiCard
              label="Em Estoque"
              value={fmt(macro.emEstoque)}
              unit="kg"
              emoji="📦"
            />
            <KpiCard
              label="Aproveitamento"
              value={fmt(macro.percentualAproveitamento)}
              unit="%"
              emoji="✅"
            />
            <KpiCard
              label="Beneficiários"
              value={macro.beneficiariosAtendidos}
              emoji="👥"
            />
          </div>

          {/* ===== Gráfico tendência ===== */}
          <div className="mb-6">
            <GraficoTendencia data={tendencia} />
          </div>

          {/* ===== Rankings ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <GraficoPizza data={topProdutos} titulo="Top 5 Produtos Doados" />
            <GraficoBarras
              data={topDoadores}
              titulo="Top 10 Doadores"
              cor="#16a34a"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <GraficoBarras
              data={topBeneficiarios}
              titulo="Top 10 Beneficiários"
              cor="#2563eb"
            />
            <GraficoBarras
              data={topProdutores}
              titulo="Top 10 Produtores Rurais"
              cor="#ea580c"
            />
          </div>

          {/* ===== 🆕 Top 5 Funcionários ===== */}
          <div className="border-t border-gray-200 pt-6 mt-2">
            <TopFuncionariosCard
              dados={participacao}
              loading={loadingPart}
            />

            {mostrarTabelaDetalhada && (
              <TabelaParticipacaoFuncionarios
                dados={participacao}
                loading={loadingPart}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

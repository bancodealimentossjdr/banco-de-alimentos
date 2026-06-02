'use client';

import { useState, useEffect } from 'react';
import FiltrosIndicadores, {
  Filters,
} from '@/components/indicadores/FiltrosIndicadores';
import KpiCard from '@/components/indicadores/KpiCard';
import GraficoTendencia from '@/components/indicadores/GraficoTendencia';
import GraficoPizza from '@/components/indicadores/GraficoPizza';
import GraficoBarras from '@/components/indicadores/GraficoBarras';
import BotoesExportacao from '@/components/indicadores/BotoesExportacao';

interface Macro {
  totalDoado: number;
  totalDistribuido: number;
  totalColheita: number;
  emEstoque: number;
  percentualAproveitamento: number;
  beneficiariosAtendidos: number;
}

export default function IndicadoresPage() {
  const [filters, setFilters] = useState<Filters | null>(null);
  const [macro, setMacro] = useState<Macro | null>(null);
  const [tendencia, setTendencia] = useState<any[]>([]);
  const [topProdutos, setTopProdutos] = useState<any[]>([]);
  const [topDoadores, setTopDoadores] = useState<any[]>([]);
  const [topBeneficiarios, setTopBeneficiarios] = useState<any[]>([]);
  const [topProdutores, setTopProdutores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filters) return;
    setLoading(true);

    const qs = `from=${filters.from}&to=${filters.to}`;

    Promise.all([
      fetch(`/api/indicadores/macro?${qs}`).then((r) => r.json()),
      fetch(`/api/indicadores/tendencias?${qs}`).then((r) => r.json()),
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
      .then(([m, t, p, d, b, pr]) => {
        setMacro(m);
        setTendencia(Array.isArray(t) ? t : []);
        setTopProdutos(Array.isArray(p) ? p : []);
        setTopDoadores(Array.isArray(d) ? d : []);
        setTopBeneficiarios(Array.isArray(b) ? b : []);
        setTopProdutores(Array.isArray(pr) ? pr : []);
      })
      .catch((e) => console.error('Erro ao carregar indicadores:', e))
      .finally(() => setLoading(false));
  }, [filters]);

  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📊 Indicadores</h1>
          <p className="text-gray-600 mt-1">
            Visão geral da operação do Banco de Alimentos
          </p>
        </div>
        <BotoesExportacao filters={filters} />
      </div>

      <FiltrosIndicadores onChange={setFilters} />

      {loading && (
        <div className="text-center py-8 text-gray-500">Carregando...</div>
      )}

      {macro && !loading && (
        <>
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

          <div className="mb-6">
            <GraficoTendencia data={tendencia} />
          </div>

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
        </>
      )}
    </div>
  );
}

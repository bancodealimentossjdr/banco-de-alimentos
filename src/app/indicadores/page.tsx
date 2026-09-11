// src/app/indicadores/page.tsx
'use client';

import { useState, useEffect } from 'react';
import FiltrosIndicadores from '@/components/indicadores/FiltrosIndicadores';
import {
  type FiltrosState,
  buildIndicadoresQuery,
} from '@/lib/indicadores/filters';
import KpiCard from '@/components/indicadores/KpiCard';
import GraficoTendencia, {
  SerieData,
} from '@/components/indicadores/GraficoTendencia';
import GraficoBarras from '@/components/indicadores/GraficoBarras';
import BotoesExportacao from '@/components/indicadores/BotoesExportacao';
import TopFuncionariosCard from '@/components/indicadores/TopFuncionariosCard';
import TabelaParticipacaoFuncionarios from '@/components/indicadores/TabelaParticipacaoFuncionarios';
import type { FuncionarioParticipacao } from '@/lib/data/indicadores-data';
import AnnonaeLoader from '@/components/ui/AnnonaeLoader';

interface Macro {
  totalDoado: number;
  totalDistribuido: number;
  totalColheita: number;
  percentualAproveitamento: number;
  beneficiariosAtendidos: number;
}

export default function IndicadoresPage() {
  const [filters, setFilters] = useState<FiltrosState | null>(null);

  const [macro, setMacro] = useState<Macro | null>(null);
  const [tendencia, setTendencia] = useState<SerieData | null>(null);
  const [topProdutos, setTopProdutos] = useState<any[]>([]);
  const [topDoadores, setTopDoadores] = useState<any[]>([]);
  const [topBeneficiarios, setTopBeneficiarios] = useState<any[]>([]);
  const [topProdutores, setTopProdutores] = useState<any[]>([]);
  const [participacao, setParticipacao] = useState<FuncionarioParticipacao[]>([]);
  const [loading, setLoading] = useState(false);

  /* ------------------------------------------------------------------
   * 🔁 UM ÚNICO efeito.
   *
   * Antes existiam dois: o primeiro montava a query à mão com apenas
   * from/to (dropdowns nunca chegavam ao servidor) e o segundo, com
   * debounce, enviava os IDs só para participacao-funcionarios. Daí o
   * sintoma: "data filtra, dropdown não".
   *
   * Agora a query é serializada por buildIndicadoresQuery() e o efeito
   * só roda quando o usuário clica em "Aplicar" — debounce dispensável.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!filters) return;
    const qs = buildIndicadoresQuery(filters);
    const ac = new AbortController();
    const get = (url: string) =>
      fetch(url, { signal: ac.signal }).then((r) => r.json());

    setLoading(true);
    Promise.all([
      get(`/api/indicadores/macro?${qs}`),
      get(`/api/indicadores/aproveitamento?${qs}&serie=true`),
      get(`/api/indicadores/rankings?${qs}&type=produtos`),
      get(`/api/indicadores/rankings?${qs}&type=doadores`),
      get(`/api/indicadores/rankings?${qs}&type=beneficiarios`),
      get(`/api/indicadores/rankings?${qs}&type=produtores`),
      get(`/api/indicadores/participacao-funcionarios?${qs}`),
    ])
      .then(([m, serie, p, d, b, pr, part]) => {
        setMacro(m);
        setTendencia(
          serie && Array.isArray(serie.points) ? (serie as SerieData) : null,
        );
        setTopProdutos(Array.isArray(p) ? p : []);
        setTopDoadores(Array.isArray(d) ? d : []);
        setTopBeneficiarios(Array.isArray(b) ? b : []);
        setTopProdutores(Array.isArray(pr) ? pr : []);
        setParticipacao(Array.isArray(part) ? part : []);
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          console.error('Erro ao carregar indicadores:', e);
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [filters]);

  const fmt = (n: number) =>
    (n ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  const exportFilters = filters ? { from: filters.from, to: filters.to } : null;
  const mostrarTabelaDetalhada = (filters?.funcionarioIds.length ?? 0) > 0;

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

      {loading && !macro && (
        <div className="py-16">
          <AnnonaeLoader label="Calculando indicadores..." />
        </div>
      )}

      {macro && (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/70 pt-24 backdrop-blur-[1px]">
              <AnnonaeLoader label="Atualizando..." />
            </div>
          )}

          <div className={loading ? 'pointer-events-none select-none' : ''}>
            {/* ===== KPIs — 5 cards (📦 Em Estoque removido na 23.7d) ===== */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <KpiCard label="Total Doado" value={fmt(macro.totalDoado)} unit="kg" emoji="🏪" />
              <KpiCard label="Distribuído" value={fmt(macro.totalDistribuido)} unit="kg" emoji="📤" />
              <KpiCard label="Colheita" value={fmt(macro.totalColheita)} unit="kg" emoji="🌾" />
              <KpiCard label="Aproveitamento" value={fmt(macro.percentualAproveitamento)} unit="%" emoji="✅" />
              <KpiCard label="Beneficiários" value={macro.beneficiariosAtendidos} emoji="👥" />
            </div>

            <div className="mb-6">
              <GraficoTendencia data={tendencia} />
            </div>

            {/* 🌾 Top Produtos agora soma doação + colheita + PAA (23.7d) */}
            <div className="mb-6">
              <GraficoBarras
                data={topProdutos}
                titulo="Top 10 Produtos Recebidos"
                cor="#16a34a"
              />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <GraficoBarras data={topDoadores} titulo="Top 10 Doadores" cor="#16a34a" />
              <GraficoBarras data={topBeneficiarios} titulo="Top 10 Beneficiários" cor="#2563eb" />
            </div>

            <div className="mb-6">
              <GraficoBarras data={topProdutores} titulo="Top 10 Produtores Rurais" cor="#ea580c" />
            </div>

            <div className="mt-2 border-t border-gray-200 pt-6">
              <TopFuncionariosCard dados={participacao} loading={loading} />
              {mostrarTabelaDetalhada && (
                <TabelaParticipacaoFuncionarios dados={participacao} loading={loading} />
              )}
            </div>

            {/* 🌾 Seção PAA entra aqui na 23.7e */}
          </div>
        </div>
      )}
    </div>
  );
}

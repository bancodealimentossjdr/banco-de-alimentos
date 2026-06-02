'use client';

import { useState, useEffect } from 'react';

export interface Filters {
  from: string;
  to: string;
}

interface Props {
  onChange: (filters: Filters) => void;
}

/* ------------------------------------------------------------------ */
/* Helpers de data                                                     */
/* ------------------------------------------------------------------ */

// formato interno (HTML / backend): YYYY-MM-DD
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// formato de exibição brasileiro: DD-MM-YYYY
function toBR(ymd: string): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-');
  return `${d}-${m}-${y}`;
}

function rangeUltimosDias(dias: number): Filters {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - dias);
  return { from: toYMD(from), to: toYMD(to) };
}

function rangeUltimosMeses(meses: number): Filters {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - meses);
  return { from: toYMD(from), to: toYMD(to) };
}

/* ------------------------------------------------------------------ */
/* Componente                                                          */
/* ------------------------------------------------------------------ */

export default function FiltrosIndicadores({ onChange }: Props) {
  // 🎯 padrão silencioso: últimos 30 dias (sem botão correspondente)
  const padrao = rangeUltimosDias(30);

  const [from, setFrom] = useState(padrao.from);
  const [to, setTo] = useState(padrao.to);

  useEffect(() => {
    onChange({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicar = () => {
    onChange({ from, to });
  };

  // presets pedidos: 7, 15, 6 meses, 1 ano (sem 30 dias)
  const presets = [
    { label: '7 dias', get: () => rangeUltimosDias(7) },
    { label: '15 dias', get: () => rangeUltimosDias(15) },
    { label: '6 meses', get: () => rangeUltimosMeses(6) },
    { label: '1 ano', get: () => rangeUltimosMeses(12) },
  ];

  const aplicarPreset = (get: () => Filters) => {
    const r = get();
    setFrom(r.from);
    setTo(r.to);
    onChange(r);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200 mb-6">
      <h2 className="text-lg font-semibold mb-3">📅 Filtros</h2>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">De</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Até</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>

        <button
          onClick={aplicar}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Aplicar
        </button>

        <div className="flex gap-2 flex-wrap">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => aplicarPreset(p.get)}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 🇧🇷 exibição explícita do período em DD-MM-YYYY (garantido) */}
      <p className="mt-3 text-sm text-gray-500">
        Período selecionado:{' '}
        <span className="font-medium text-gray-700">{toBR(from)}</span> até{' '}
        <span className="font-medium text-gray-700">{toBR(to)}</span>
      </p>
    </div>
  );
}

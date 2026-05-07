'use client';

import { useState, useEffect } from 'react';

export interface Filters {
  from: string;
  to: string;
}

interface Props {
  onChange: (filters: Filters) => void;
}

export default function FiltrosIndicadores({ onChange }: Props) {
  const today = new Date();
  const yearAgo = new Date();
  yearAgo.setFullYear(today.getFullYear() - 1);

  const [from, setFrom] = useState(yearAgo.toISOString().split('T')[0]);
  const [to, setTo] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    onChange({ from, to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicar = () => {
    onChange({ from, to });
  };

  const presets = [
    { label: '30 dias', days: 30 },
    { label: '90 dias', days: 90 },
    { label: '1 ano', days: 365 },
  ];

  const aplicarPreset = (days: number) => {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - days);
    const fStr = f.toISOString().split('T')[0];
    const tStr = t.toISOString().split('T')[0];
    setFrom(fStr);
    setTo(tStr);
    onChange({ from: fStr, to: tStr });
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
              key={p.days}
              onClick={() => aplicarPreset(p.days)}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

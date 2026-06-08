'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

// 🔧 Tipo local — antes vinha de FiltrosIndicadores como "Filters"
// Mantido aqui pra não acoplar ao novo FiltrosState (que tem outra estrutura).
export type ExportFilters = {
  from: string;
  to: string;
};

interface Props {
  filters: ExportFilters | null;
}

export default function BotoesExportacao({ filters }: Props) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [semCensura, setSemCensura] = useState(false);
  const [baixando, setBaixando] = useState<'pdf' | 'excel' | null>(null);

  const exportar = (format: 'pdf' | 'excel') => {
    if (!filters) return;
    setBaixando(format);

    const params = new URLSearchParams({
      from: filters.from,
      to: filters.to,
      format,
    });
    if (isAdmin && semCensura) params.set('mask', 'false');

    const url = `/api/indicadores/export?${params.toString()}`;

    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => setBaixando(null), 1200);
  };

  const desabilitado = !filters || baixando !== null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => exportar('pdf')}
          disabled={desabilitado}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {baixando === 'pdf' ? '⏳ Gerando...' : '📄 Exportar PDF'}
        </button>

        <button
          type="button"
          onClick={() => exportar('excel')}
          disabled={desabilitado}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {baixando === 'excel' ? '⏳ Gerando...' : '📊 Exportar Excel'}
        </button>
      </div>

      {isAdmin && (
        <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={semCensura}
            onChange={(e) => setSemCensura(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          Exportar sem censura
          <span className="text-xs text-amber-600">(dados sensíveis)</span>
        </label>
      )}
    </div>
  );
}

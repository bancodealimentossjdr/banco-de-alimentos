// src/app/api/eventos/[id]/campo/CardIngressos.tsx
"use client";

import { useEffect, useState } from "react";

type Reserva = {
  id: string;
  protocolo: string;
  showLabel: string;
  showData: string;
  retirado: boolean;
  retiradoEm: string | null;
  retiradoPorNome: string | null;
};

type BuscarResponse = {
  encontrado: boolean;
  cpf: string;
  nome?: string;
  reservas: Reserva[];
  totalDisponiveis?: number;
  totalRetirados?: number;
};

function soDigitos(v: string) {
  return (v || "").replace(/\D/g, "");
}

function fmtDataHora(iso: string | Date | null): string {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDataShow(iso: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export default function CardIngressos({ cpf }: { cpf: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "found" | "notfound" | "error">("idle");
  const [data, setData] = useState<BuscarResponse | null>(null);

  const cpfLimpo = soDigitos(cpf);

  useEffect(() => {
    // só busca quando tiver exatamente 11 dígitos
    if (cpfLimpo.length !== 11) {
      setStatus("idle");
      setData(null);
      return;
    }

    let cancelado = false;
    const ctrl = new AbortController();

    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/ingressos/buscar?cpf=${cpfLimpo}`, {
          signal: ctrl.signal,
        });
        const json: BuscarResponse = await res.json();
        if (cancelado) return;

        if (!res.ok) {
          setStatus("error");
          setData(null);
          return;
        }

        if (json.encontrado && json.reservas?.length) {
          setData(json);
          setStatus("found");
        } else {
          setData(json);
          setStatus("notfound");
        }
      } catch (e) {
        if (cancelado) return;
        if ((e as Error)?.name === "AbortError") return;
        setStatus("error");
        setData(null);
      }
    }, 400); // debounce

    return () => {
      cancelado = true;
      ctrl.abort();
      clearTimeout(t);
    };
  }, [cpfLimpo]);

  // nada renderiza enquanto o CPF não estiver completo
  if (cpfLimpo.length !== 11) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">🎫</span>
        <h3 className="text-sm font-semibold text-amber-900">Ingressos — Minha São João</h3>
      </div>

      {status === "loading" && (
        <p className="text-sm text-amber-700">Buscando reservas…</p>
      )}

      {status === "notfound" && (
        <p className="text-sm text-amber-700">
          Nenhuma reserva encontrada para este CPF.
        </p>
      )}

      {status === "error" && (
        <p className="text-sm text-red-600">
          Erro ao buscar. Tente novamente.
        </p>
      )}

      {status === "found" && data && (
        <div className="space-y-3">
          <p className="text-sm text-amber-900">
            <span className="font-medium">Nome:</span> {data.nome}
          </p>

          <ul className="space-y-2">
            {data.reservas.map((r) => (
              <li
  key={r.id}
  className="rounded-xl border border-amber-200 bg-white p-3.5 shadow-sm transition hover:border-amber-300"
>
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <p className="text-base font-bold text-amber-900 truncate">
        🎤 {r.showLabel}
      </p>
      <p className="mt-0.5 text-sm font-medium capitalize text-amber-600">
        {fmtDataShow(r.showData)}
      </p>
      <p className="mt-1 text-[11px] text-gray-400">
        Protocolo: {r.protocolo}
      </p>
    </div>

    {r.retirado ? (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">
        ✓ Retirado
      </span>
    ) : (
      <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Disponível
      </span>
    )}
  </div>

  {r.retirado && (
    <p className="mt-2 border-t border-amber-100 pt-1.5 text-[11px] text-gray-400">
      {fmtDataHora(r.retiradoEm)}
      {r.retiradoPorNome ? ` · por ${r.retiradoPorNome}` : ""}
    </p>
  )}
</li>
            ))}
          </ul>

          {(data.totalDisponiveis != null || data.totalRetirados != null) && (
            <p className="text-xs text-amber-700">
              {data.totalDisponiveis ?? 0} disponível(is) ·{" "}
              {data.totalRetirados ?? 0} retirado(s)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

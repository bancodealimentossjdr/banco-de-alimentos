"use client";

import { useState } from "react";
import toast from "react-hot-toast";

type Reserva = {
  id: string;
  protocolo: string;
  showLabel: string;
  showData: string;
  retirado: boolean;
  retiradoEm: string | null;
  retiradoPorNome: string | null;
};

type Resultado = {
  encontrado: boolean;
  cpf: string;
  nome?: string;
  reservas: Reserva[];
  totalDisponiveis?: number;
  totalRetirados?: number;
};

function fmtCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function fmtDataHora(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtShowData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function CardBuscaCpf({
  onReservaRetirada,
}: {
  onReservaRetirada?: (reserva: Reserva) => void;
}) {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function buscar() {
    const digitos = cpf.replace(/\D/g, "");
    if (digitos.length !== 11) {
      toast.error("Digite os 11 dígitos do CPF.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/ingressos/buscar?cpf=${digitos}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro na busca.");
        setResultado(null);
        return;
      }
      setResultado(data);
      if (!data.encontrado) toast("Nenhuma reserva para este CPF.");
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function marcarRetirada(reserva: Reserva) {
    if (reserva.retirado) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ingressos/retirar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservaId: reserva.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao marcar retirada.");
        await buscar(); // sincroniza caso alguém já tenha retirado
        return;
      }
      toast.success("Retirada registrada!");
      onReservaRetirada?.(data.reserva);
      await buscar();
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Campo CPF */}
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          value={cpf}
          onChange={(e) => setCpf(fmtCpf(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="Digite o CPF"
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={buscar}
          disabled={loading}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {/* Card informativo */}
      {resultado?.encontrado && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="mb-3 border-b pb-2">
            <p className="text-xs uppercase text-gray-500">Titular</p>
            <p className="text-lg font-semibold text-gray-800">{resultado.nome}</p>
            <p className="text-xs text-gray-500">CPF {fmtCpf(resultado.cpf)}</p>
          </div>

          <p className="mb-2 text-sm font-medium text-gray-700">
            Shows reservados ({resultado.reservas.length})
          </p>

          <ul className="space-y-2">
            {resultado.reservas.map((r) => (
              <li
                key={r.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  r.retirado ? "bg-red-50" : "bg-green-50"
                }`}
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{r.showLabel}</p>
                  <p className="text-xs text-gray-500">
                    {fmtShowData(r.showData)} · Protocolo {r.protocolo}
                  </p>
                  {r.retirado && (
                    <p className="mt-1 text-xs font-medium text-red-600">
                      🔴 Não está mais disponível — retirado em{" "}
                      {fmtDataHora(r.retiradoEm)}
                      {r.retiradoPorNome ? ` por ${r.retiradoPorNome}` : ""}
                    </p>
                  )}
                </div>

                {r.retirado ? (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                    Retirado
                  </span>
                ) : (
                  <button
                    onClick={() => marcarRetirada(r)}
                    disabled={loading}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Marcar retirada
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sem reservas */}
      {resultado && !resultado.encontrado && (
        <div className="rounded-xl border border-dashed p-4 text-center text-sm text-gray-500">
          Nenhuma reserva encontrada para o CPF {fmtCpf(resultado.cpf)}.
        </div>
      )}
    </div>
  );
}

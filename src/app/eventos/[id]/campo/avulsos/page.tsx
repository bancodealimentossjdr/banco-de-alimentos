"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

type Avulso = {
  id: string;
  cpf: string;
  nome: string;
  email: string;
  createdAt: string;
  shows: string[]; // 🆕
};

// 🎤 rótulos amigáveis
const SHOW_LABEL: Record<string, string> = {
  "hugo-guilherme-13": "13/08 · Hugo e Guilherme",
  "ana-castela-14": "14/08 · Ana Castela",
  "daniel-15": "15/08 · Daniel",
  "mariana-fagundes-16": "16/08 · Mariana Fagundes",
};

function fmtCpf(v: string) {
  const d = (v || "").replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function fmtDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AvulsosPage() {
  const [itens, setItens] = useState<Avulso[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [temMais, setTemMais] = useState(true);
  const [loading, setLoading] = useState(false);
  const [negado, setNegado] = useState(false);

  const [editando, setEditando] = useState<Avulso | null>(null);
  const [salvando, setSalvando] = useState(false);

  const sentinela = useRef<HTMLDivElement | null>(null);

  const carregar = useCallback(async () => {
    if (loading || !temMais) return;
    setLoading(true);
    try {
      const url = cursor
        ? `/api/ingressos/avulso?cursor=${cursor}`
        : `/api/ingressos/avulso`;
      const res = await fetch(url);
      if (res.status === 403) {
        setNegado(true);
        setTemMais(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao carregar.");
        return;
      }
      setItens((prev) => [...prev, ...data.itens]);
      setCursor(data.proxCursor);
      setTemMais(!!data.proxCursor);
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }, [cursor, loading, temMais]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinela.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) carregar();
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [carregar]);

  async function excluir(id: string) {
    if (!confirm("Excluir este registro? Ação não pode ser desfeita.")) return;
    try {
      const res = await fetch(`/api/ingressos/avulso/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao excluir.");
        return;
      }
      setItens((prev) => prev.filter((i) => i.id !== id));
      toast.success("Registro excluído.");
    } catch {
      toast.error("Falha de conexão.");
    }
  }

  async function salvarEdicao() {
    if (!editando) return;
    setSalvando(true);
    try {
      const res = await fetch(`/api/ingressos/avulso/${editando.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: editando.cpf,
          nome: editando.nome,
          email: editando.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao salvar.");
        return;
      }
      setItens((prev) =>
        prev.map((i) =>
          i.id === editando.id ? { ...data.registro, shows: i.shows } : i
        )
      );
      toast.success("Registro atualizado.");
      setEditando(null);
    } catch {
      toast.error("Falha de conexão.");
    } finally {
      setSalvando(false);
    }
  }

  if (negado) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <p className="text-lg font-semibold text-red-600">Acesso restrito</p>
        <p className="mt-1 text-sm text-gray-500">
          Esta página é exclusiva para o desenvolvedor.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <p className="text-sm text-gray-500">Expo del-Rei · Dev</p>
        <h1 className="text-2xl font-bold text-gray-900">Trocas avulsas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pessoas que trocaram ingresso sem reserva cadastrada.
        </p>
      </header>

      <ul className="space-y-3">
        {itens.map((r) => (
          <li key={r.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-gray-800">
                  {r.nome}
                </p>
                <p className="text-sm text-gray-600">CPF {fmtCpf(r.cpf)}</p>
                <p className="truncate text-sm text-gray-600">{r.email}</p>

                {/* 🆕 badges de shows */}
                {r.shows?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.shows.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                      >
                        🎤 {SHOW_LABEL[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-1 text-xs text-gray-400">
                  {fmtDataHora(r.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  onClick={() => setEditando(r)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => excluir(r.id)}
                  className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  🗑️ Excluir
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {itens.length === 0 && !loading && (
        <p className="mt-6 text-center text-sm text-gray-400">
          Nenhuma troca avulsa registrada ainda.
        </p>
      )}

      <div ref={sentinela} className="h-10" />
      {loading && (
        <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>
      )}
      {!temMais && itens.length > 0 && (
        <p className="py-4 text-center text-xs text-gray-400">Fim da lista.</p>
      )}

      {/* Modal editar */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold text-gray-900">
              Editar registro
            </h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs uppercase text-gray-500">
                  CPF
                </label>
                <input
                  type="text"
                  value={editando.cpf}
                  onChange={(e) =>
                    setEditando({ ...editando, cpf: e.target.value })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-gray-500">
                  Nome
                </label>
                <input
                  type="text"
                  value={editando.nome}
                  onChange={(e) =>
                    setEditando({ ...editando, nome: e.target.value })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-gray-500">
                  E-mail
                </label>
                <input
                  type="email"
                  value={editando.email}
                  onChange={(e) =>
                    setEditando({ ...editando, email: e.target.value })
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setEditando(null)}
                className="flex-1 rounded-lg border border-gray-300 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarEdicao}
                disabled={salvando}
                className="flex-1 rounded-lg bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {salvando ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { normalizeCpf } from "./cpf";
import { RESERVAS } from "./reservas-data";

// Mapa show → ID do formulário (mantido só para referência/labels)
export const SHOW_FORM_IDS: Record<string, number> = {
  "2026-08-13": 162, // Hugo & Guilherme (quinta)
  "2026-08-15": 163, // Daniel (sábado)
  "2026-08-16": 164, // Mariana Fagundes (domingo)
  // ❌ Ana Castela (14/08) NÃO entra na troca
};

export interface ReservaEncontrada {
  showDia: string;
  formId: number;
  protocolo: string | null;
  nome: string | null;
  cpf: string;
  raw: unknown;
}

/**
 * Busca TODAS as reservas de um CPF em todas as planilhas/shows.
 * Chave = campo `cpf` normalizado (11 dígitos). 1 linha = 1 reserva.
 * Fonte agora é local (RESERVAS), não mais a API appcidades.
 */
export async function buscarReservasPorCpf(
  cpfRaw: string
): Promise<ReservaEncontrada[]> {
  const cpf = normalizeCpf(cpfRaw);
  if (cpf.length !== 11) return [];

  return RESERVAS.filter((r) => r.cpf === cpf).map((r) => ({
    showDia: r.showDia,
    formId: SHOW_FORM_IDS[r.showDia] ?? 0,
    protocolo: r.protocolo,
    nome: r.nome,
    cpf,
    raw: r,
  }));
}

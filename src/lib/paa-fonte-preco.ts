// src/lib/paa-fonte-preco.ts
/**
 * 🏛️ Onda 24 — Fonte dos preços de referência do PAA.
 * A fonte varia por organização (CONAB, município, estado), por isso é
 * identificada pelos mesmos dados institucionais que saem no Termo de
 * Recebimento (PaaConfig). Não fixa "CONAB" em lugar nenhum.
 */
export type PaaFonteConfig = {
  unidadeExecutora?: string | null
  termoAdesao?: string | null
  proposta?: string | null
}

export const PAA_FONTE_VAZIA =
  'Preencha os dados institucionais do PAA para identificar a fonte dos preços.'

export function fontePrecoPaa(cfg: PaaFonteConfig | null | undefined): string {
  const partes = [
    cfg?.termoAdesao?.trim() ? `Termo de Adesão nº ${cfg.termoAdesao.trim()}` : null,
    cfg?.proposta?.trim() ? `Proposta ${cfg.proposta.trim()}` : null,
    cfg?.unidadeExecutora?.trim() || null,
  ].filter(Boolean)

  return partes.length
    ? `Preços de referência do PAA — ${partes.join(' · ')}`
    : PAA_FONTE_VAZIA
}

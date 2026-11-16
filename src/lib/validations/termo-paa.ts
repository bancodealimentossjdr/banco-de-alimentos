import { z } from "zod";
import { normalizeCpf, isCpfValido } from "@/lib/cpf";

// ============================================
// ONDA 23.9a — Validações do Termo PAA
// O servidor SEMPRE revalida (o front é só conveniência).
// ============================================

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
export const NUMERO_TERMO_REGEX = /^\d+\/\d{4}\.\d+$/;

/** Data "YYYY-MM-DD" que existe no calendário. */
const dataCivil = z
  .string()
  .regex(DATA_ISO, "Data deve estar no formato AAAA-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Data inválida");

/** String opcional: "" e espaços viram null. */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

// ---------- Producer (campos PAA) ----------
export const producerPaaSchema = z.object({
  cpf: z
    .string()
    .nullish()
    .transform((v) => (v ? normalizeCpf(v) : null))
    .refine((v) => v === null || isCpfValido(v), "CPF inválido"),
  dapCaf: z
    .string()
    .trim()
    .max(40, "CAF/DAP muito longo")
    .nullish()
    .transform((v) => (v ? v.toUpperCase() : null)),
});
export type ProducerPaaInput = z.infer<typeof producerPaaSchema>;

// ---------- Criar Termo ----------
export const criarTermoSchema = z.object({
  numeroTermo: z
    .string()
    .trim()
    .regex(NUMERO_TERMO_REGEX, "Número do Termo no formato do SISPAA (ex.: 123/2026.1)"),
  dataTermo: dataCivil,
  producerId: z.string().min(1, "Produtor obrigatório"),
  entregaIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma entrega")
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, "Entregas repetidas"),
});
export type CriarTermoInput = z.infer<typeof criarTermoSchema>;

// ---------- Dados pós-emissão (só admin/dev; gate no servidor) ----------
export const atualizarTermoAdminSchema = z
  .object({
    notaFiscal: textoOpcional(30),
    dataAteste: dataCivil.nullish().transform((v) => v ?? null),
    observacaoInterna: textoOpcional(2000),
  })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Nada para atualizar");
export type AtualizarTermoAdminInput = z.infer<typeof atualizarTermoAdminSchema>;

// ---------- PaaConfig institucional (só admin/dev) ----------
export const paaConfigInstitucionalSchema = z.object({
  unidadeExecutora: textoOpcional(150),
  termoAdesao: textoOpcional(40),
  proposta: textoOpcional(60),
  planoOperacional: textoOpcional(60),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF com 2 letras")
    .nullish()
    .transform((v) => v ?? null),
  municipio: z
    .string()
    .trim()
    .max(80)
    .nullish()
    .transform((v) => (v ? v.toUpperCase() : null)),
});
export type PaaConfigInstitucionalInput = z.infer<typeof paaConfigInstitucionalSchema>;

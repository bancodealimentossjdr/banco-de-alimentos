/** Remove tudo que não for dígito. Fonte única de verdade do CPF. */
export function normalizeCpf(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Valida se tem 11 dígitos (não valida dígito verificador — foco em campo). */
export function isCpfLength(cpf: string): boolean {
  return normalizeCpf(cpf).length === 11;
}

/** Remove tudo que não for dígito. Fonte única de verdade do CPF. */
export function normalizeCpf(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Valida se tem 11 dígitos (não valida dígito verificador — foco em campo/Eventos). */
export function isCpfLength(cpf: string): boolean {
  return normalizeCpf(cpf).length === 11;
}

/**
 * 23.9a — Validação completa com dígitos verificadores.
 * Usar onde o CPF vai para documento oficial (Termo PAA).
 */
export function isCpfValido(raw: string | null | undefined): boolean {
  const cpf = normalizeCpf(raw);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, peso: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (peso - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

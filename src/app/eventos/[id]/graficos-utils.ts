// Funções puras + tipos — SEM Recharts.
// Assim EventoDetalheClient importa daqui e NÃO arrasta a lib de gráficos.

export interface EventoMetrics {
  totalKg: number
  totalRefugoKg: number
  totalLiquidoKg: number
  kgPorLocal: { nome: string; kg: number }[]
  kgPorTipo: { tipo: string; kg: number }[]
  kgPorDia: { dia: string; kg: number }[]
}

export interface Fato {
  localNome: string
  tipo: string
  unidade: string
  dia: string // YYYY-MM-DD
  quantidade: number
}

export interface Range {
  min: string
  max: string
  defaultStart: string
  defaultEnd: string
}

const round = (n: number) => Math.round(n * 100) / 100

export function derivarMetrics(fatos: Fato[]): Pick<
  EventoMetrics,
  'totalKg' | 'kgPorLocal' | 'kgPorTipo' | 'kgPorDia'
> {
  const porLocal = new Map<string, number>()
  const porTipo = new Map<string, number>()
  const porDia = new Map<string, number>()
  let totalKg = 0

  for (const f of fatos) {
    totalKg += f.quantidade
    porLocal.set(f.localNome, (porLocal.get(f.localNome) ?? 0) + f.quantidade)
    porTipo.set(f.tipo, (porTipo.get(f.tipo) ?? 0) + f.quantidade)
    porDia.set(f.dia, (porDia.get(f.dia) ?? 0) + f.quantidade)
  }

  return {
    totalKg: round(totalKg),
    kgPorLocal: [...porLocal.entries()]
      .map(([nome, kg]) => ({ nome, kg: round(kg) }))
      .sort((a, b) => b.kg - a.kg),
    kgPorTipo: [...porTipo.entries()]
      .map(([tipo, kg]) => ({ tipo, kg: round(kg) }))
      .sort((a, b) => b.kg - a.kg),
    kgPorDia: [...porDia.entries()]
      .map(([dia, kg]) => ({ dia, kg: round(kg) }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
  }
}

export function filtrarFatos(fatos: Fato[], inicio: string, fim: string): Fato[] {
  return fatos.filter((f) => f.dia >= inicio && f.dia <= fim)
}

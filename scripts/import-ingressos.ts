import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import path from 'path'

const prisma = new PrismaClient()

// ⚠️ troque pelo id de um user admin real do seu banco
const IMPORTADO_POR_ID = 'COLE_AQUI_ID_DE_UM_USER'

const ARQUIVOS = [
  { file: 'DANIEL - 15-08-2026 (sábado).xlsx',                 label: 'Daniel',           data: '2026-08-15', operador: 'Daniel' },
  { file: 'MARIANA FAGUNDES - 16-08-2026 (domingo).xlsx',      label: 'Mariana Fagundes', data: '2026-08-16', operador: 'Mariana Fagundes' },
  { file: 'HUGO E GUILHERME - 13-08-2026 (quinta-feira).xlsx', label: 'Hugo e Guilherme', data: '2026-08-13', operador: 'Hugo e Guilherme' },
]

const norm = (v: unknown) => String(v ?? '').trim()
const soDigitos = (v: unknown) => norm(v).replace(/\D/g, '')
const foiRetirado = (v: unknown) => norm(v).toLowerCase().startsWith('sim')

async function main() {
  for (const arq of ARQUIVOS) {
    const caminho = path.resolve(process.cwd(), 'data/ingressos', arq.file)
    const wb = XLSX.readFile(caminho)

    // 🔑 lê TODAS as abas e junta as linhas
    const todasLinhas: Record<string, unknown>[] = []
    for (const nomeAba of wb.SheetNames) {
      const ws = wb.Sheets[nomeAba]
      const linhasAba = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      todasLinhas.push(...linhasAba)
    }

    // filtra linhas sem CPF ou sem protocolo
    const validas = todasLinhas.filter(l => soDigitos(l['CPF']) && norm(l['Protocolo']))

    console.log(`📄 ${arq.label}: ${wb.SheetNames.length} abas, ${todasLinhas.length} linhas brutas, ${validas.length} válidas`)

    // idempotência do LOTE: reaproveita se já existir pelo nomeArquivo
    const lote = await prisma.loteIngresso.upsert({
      where: { nomeArquivo: arq.file },
      update: {
        operador: arq.operador,
        showData: new Date(arq.data),
        showLabel: arq.label,
        importadoPorId: IMPORTADO_POR_ID,
        totalLinhas: validas.length,
      },
      create: {
        nomeArquivo: arq.file,
        operador: arq.operador,
        showData: new Date(arq.data),
        showLabel: arq.label,
        importadoPorId: IMPORTADO_POR_ID,
        totalLinhas: validas.length,
      },
    })

    let ok = 0
    for (const l of validas) {
      const protocolo = norm(l['Protocolo'])
      const dados = {
        cpf: soDigitos(l['CPF']),
        nome: norm(l['Nome Completo']),
        dataNasc: norm(l['Data de Nascimento']) || null,
        cidade: norm(l['Cidade']) || null,
        bairro: norm(l['Bairro']) || null,
        retirado: foiRetirado(l['Já retirou o ingresso?']),
      }
      await prisma.reservaIngresso.upsert({
        where: { loteId_protocolo: { loteId: lote.id, protocolo } },
        update: dados,
        create: { loteId: lote.id, protocolo, ...dados },
      })
      ok++
    }

    console.log(`✅ ${arq.label}: ${ok}/${validas.length} reservas importadas (lote ${lote.id})`)
  }
}

main()
  .catch((e) => { console.error('❌ Erro:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);   // ← ADICIONE
const XLSX = require("xlsx");                       // ← ADICIONE

const ARQUIVOS = [
  { file: "planilhas/HUGO E GUILHERME - 130-08-2026 (quinta-feira).xlsx", showDia: "2026-08-13" },
  { file: "planilhas/DANIEL - 15-08-2026 (sábado).xlsx",                  showDia: "2026-08-15" },
  { file: "planilhas/MARIANA FAGUNDES - 16-08-2026 (domingo).xlsx",       showDia: "2026-08-16" },
];


const COL = {
  cpf: "CPF",
  nome: "Nome Completo",
  protocolo: "Protocolo",
};

function normalizeCpf(v) {
  return String(v ?? "").replace(/\D/g, "").padStart(11, "0").slice(-11);
}
function limpar(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ").replace(/"/g, '\\"');
}

const reservas = [];
const vistos = new Set();
let totalLidas = 0;
const invalidas = [];
const duplicadas = [];

for (const { file, showDia } of ARQUIVOS) {
  const wb = XLSX.readFile(resolve(file));
  let doArquivo = 0;

  for (const nomeAba of wb.SheetNames) {
    const sheet = wb.Sheets[nomeAba];
    const linhas = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    for (const linha of linhas) {
      totalLidas++;
      const cpf = normalizeCpf(linha[COL.cpf] || linha["Cpf Cidadão"]);
      const nome = limpar(linha[COL.nome] || linha["Nome Cidadão"]);
      const protocolo = limpar(linha[COL.protocolo]);

      if (cpf.length !== 11 || cpf.replace(/0/g, "").length === 0) {
        invalidas.push({ file, aba: nomeAba, protocolo, nome });
        continue;
      }

      const chave = `${showDia}|${cpf}`;
      if (vistos.has(chave)) {
        duplicadas.push({ file, aba: nomeAba, cpf, nome });
        continue;
      }
      vistos.add(chave);

      reservas.push({ showDia, protocolo, cpf, nome });
      doArquivo++;
    }
  }
  console.log(`📄 ${file}\n   abas: ${wb.SheetNames.length} → ${doArquivo} reservas válidas`);
}

const corpo = reservas
  .map((r) => `  { showDia: "${r.showDia}", protocolo: "${r.protocolo}", cpf: "${r.cpf}", nome: "${r.nome}" },`)
  .join("\n");

const ts = `// ⚠️ ARQUIVO GERADO AUTOMATICAMENTE por scripts/gerar-reservas.mjs
// NÃO edite à mão. Regenere: node scripts/gerar-reservas.mjs
// Total: ${reservas.length} reservas | Gerado em ${new Date().toISOString()}

export interface ReservaLocal {
  showDia: string;
  protocolo: string;
  cpf: string;
  nome: string;
}

export const RESERVAS: ReservaLocal[] = [
${corpo}
];

/** Busca reserva por CPF (aceita com ou sem máscara) e opcionalmente por dia. */
export function buscarPorCpf(cpfInput: string, showDia?: string): ReservaLocal[] {
  const cpf = cpfInput.replace(/\\D/g, "").padStart(11, "0").slice(-11);
  return RESERVAS.filter(
    (r) => r.cpf === cpf && (showDia ? r.showDia === showDia : true)
  );
}
`;

writeFileSync(resolve("src/lib/reservas-data.ts"), ts, "utf8");

console.log("\n✅ src/lib/reservas-data.ts gerado!");
console.log(`   Linhas lidas:     ${totalLidas}`);
console.log(`   Reservas válidas: ${reservas.length}`);
console.log(`   CPF inválido:     ${invalidas.length}`);
console.log(`   Duplicadas (mesmo dia+CPF): ${duplicadas.length}`);

if (invalidas.length) {
  console.warn("\n⚠️ Ignoradas por CPF inválido (primeiras 10):");
  invalidas.slice(0, 10).forEach((r, i) =>
    console.warn(`   [${i + 1}] ${r.aba} | prot ${r.protocolo} | ${r.nome}`));
}

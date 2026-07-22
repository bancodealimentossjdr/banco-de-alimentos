// scripts/gerar-reservas.mjs
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

// 🎤 FONTE ÚNICA DE VERDADE do line-up.
// showDia (ISO) → dados canônicos do show. Nada de string solta.
const LINEUP = {
  "2026-08-13": {
    showValue: "hugo-guilherme-13",
    artista: "Hugo e Guilherme",
    showLabel: "13/08 • Hugo e Guilherme",
    diaSemana: "quinta-feira",
  },
  "2026-08-15": {
    showValue: "daniel-15",
    artista: "Daniel",
    showLabel: "15/08 • Daniel",
    diaSemana: "sábado",
  },
  "2026-08-16": {
    showValue: "mariana-fagundes-16",
    artista: "Mariana Fagundes",
    showLabel: "16/08 • Mariana Fagundes",
    diaSemana: "domingo",
  },
};

const ARQUIVOS = [
  { file: "planilhas/HUGO E GUILHERME - 130-08-2026 (quinta-feira).xlsx", showDia: "2026-08-13" },
  { file: "planilhas/DANIEL - 15-08-2026 (sábado).xlsx", showDia: "2026-08-15" },
  { file: "planilhas/MARIANA FAGUNDES - 16-08-2026 (domingo).xlsx", showDia: "2026-08-16" },
];

const COL = {
  cpf: "CPF",
  nome: "Nome Completo",
  protocolo: "Protocolo",
};

function normalizeCpf(v) {
  return String(v ?? "").replace(/\D/g, "").padStart(11, "0").slice(-11);
}

// ✅ limpeza segura: NÃO escapa aspas na mão (JSON.stringify cuida disso depois)
function limpar(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

const reservas = [];
const vistos = new Set();
let totalLidas = 0;
const invalidas = [];
const duplicadas = [];
const semProtocolo = [];

for (const { file, showDia } of ARQUIVOS) {
  const show = LINEUP[showDia];
  if (!show) {
    console.warn(`⚠️ showDia sem line-up cadastrado: ${showDia} (arquivo ${file}) — pulado.`);
    continue;
  }

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

      if (!protocolo) {
        semProtocolo.push({ file, aba: nomeAba, cpf, nome });
        // não abortamos: seguimos, mas registramos o alerta
      }

      // 🔑 dedup por dia + CPF + protocolo (mais estrito que antes)
      const chave = `${showDia}|${cpf}|${protocolo}`;
      if (vistos.has(chave)) {
        duplicadas.push({ file, aba: nomeAba, cpf, nome, protocolo });
        continue;
      }
      vistos.add(chave);

      reservas.push({
        showDia,
        showValue: show.showValue,
        showLabel: show.showLabel, // ← canônico, único, vindo do LINEUP
        protocolo,
        cpf,
        nome, // ← nome da PESSOA (titular)
      });
      doArquivo++;
    }
  }
  console.log(`📄 ${file}\n   abas: ${wb.SheetNames.length} → ${doArquivo} reservas válidas`);
}

// ordena por dia, depois por nome — saída determinística
reservas.sort((a, b) =>
  a.showDia === b.showDia ? a.nome.localeCompare(b.nome, "pt-BR") : a.showDia.localeCompare(b.showDia)
);

// ✅ JSON.stringify em cada campo = escape 100% seguro (aspas, acentos, etc.)
const corpo = reservas
  .map(
    (r) =>
      `  { showDia: ${JSON.stringify(r.showDia)}, showValue: ${JSON.stringify(
        r.showValue
      )}, showLabel: ${JSON.stringify(r.showLabel)}, protocolo: ${JSON.stringify(
        r.protocolo
      )}, cpf: ${JSON.stringify(r.cpf)}, nome: ${JSON.stringify(r.nome)} },`
  )
  .join("\n");

const ts = `// ⚠️ ARQUIVO GERADO AUTOMATICAMENTE por scripts/gerar-reservas.mjs
// NÃO edite à mão. Regenere: node scripts/gerar-reservas.mjs
// Total: ${reservas.length} reservas | Gerado em ${new Date().toISOString()}

export interface ReservaLocal {
  showDia: string;
  showValue: string;
  showLabel: string;
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
console.log(`   Linhas lidas:               ${totalLidas}`);
console.log(`   Reservas válidas:           ${reservas.length}`);
console.log(`   CPF inválido:               ${invalidas.length}`);
console.log(`   Sem protocolo:              ${semProtocolo.length}`);
console.log(`   Duplicadas (dia+CPF+prot):  ${duplicadas.length}`);

if (invalidas.length) {
  console.warn("\n⚠️ Ignoradas por CPF inválido (primeiras 10):");
  invalidas.slice(0, 10).forEach((r, i) =>
    console.warn(`   [${i + 1}] ${r.aba} | prot ${r.protocolo} | ${r.nome}`)
  );
}
if (semProtocolo.length) {
  console.warn("\n⚠️ Sem protocolo (primeiras 10):");
  semProtocolo.slice(0, 10).forEach((r, i) =>
    console.warn(`   [${i + 1}] ${r.aba} | cpf ${r.cpf} | ${r.nome}`)
  );
}

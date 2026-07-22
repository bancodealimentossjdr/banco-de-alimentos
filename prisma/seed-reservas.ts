import { PrismaClient, type Prisma } from "@prisma/client";
import { RESERVAS, type ReservaLocal } from "../src/lib/reservas-data";

const prisma = new PrismaClient();

// ⚙️ AJUSTE OBRIGATÓRIO: id de um User existente
const IMPORTADO_POR_ID = "COLE_AQUI_UM_USER_ID_VALIDO";

const BATCH_SIZE = 1000;

const LABEL_POR_DIA: Record<string, string> = {
  "2026-08-13": "Show 13/08 (quinta)",
  "2026-08-15": "Show 15/08 (sábado)",
  "2026-08-16": "Show 16/08 (domingo)",
};

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const reservas: ReservaLocal[] = RESERVAS;
  console.log(`📦 ${reservas.length} reservas no arquivo.`);

  // 1) Agrupa por showDia
  const porDia = new Map<string, ReservaLocal[]>();
  for (const r of reservas) {
    const lista = porDia.get(r.showDia) ?? [];
    lista.push(r);
    porDia.set(r.showDia, lista);
  }
  console.log(`📅 Dias: ${[...porDia.keys()].join(", ")}`);

  let totalInserido = 0;

  for (const [showDia, reservasDoDia] of porDia) {
    const nomeArquivo = `reserva-datas__${showDia}`;

    const lote = await prisma.loteIngresso.upsert({
      where: { nomeArquivo },
      update: {},
      create: {
        nomeArquivo,
        operador: "seed-script",
        showData: new Date(`${showDia}T00:00:00.000Z`),
        showLabel: LABEL_POR_DIA[showDia] ?? `Show ${showDia}`,
        importadoPorId: IMPORTADO_POR_ID,
        totalLinhas: reservasDoDia.length,
      },
    });
    console.log(`\n🎫 ${showDia} → lote ${lote.id} (${reservasDoDia.length})`);

    // 2) Tipagem explícita → mata ts(7006) e ts(2322)
    const data: Prisma.ReservaIngressoCreateManyInput[] = reservasDoDia.map(
      (r: ReservaLocal) => ({
        loteId: lote.id,
        protocolo: r.protocolo.trim(),
        cpf: r.cpf.replace(/\D/g, ""),
        nome: r.nome.trim(),
        retirado: false,
      })
    );

    const batches = chunk(data, BATCH_SIZE);
    for (let i = 0; i < batches.length; i++) {
      const res = await prisma.reservaIngresso.createMany({
        data: batches[i],
        skipDuplicates: true,
      });
      totalInserido += res.count;
      console.log(`  ➕ ${i + 1}/${batches.length} → ${res.count}`);
    }
  }

  console.log(`\n✅ Total inserido: ${totalInserido}/${reservas.length}`);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

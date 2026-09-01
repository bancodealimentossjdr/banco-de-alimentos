import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type PaaRow = {
  codigo: number;
  nome: string;
  categoria: string;
  unidade: string;
  precoConv: string | null;
  precoOrg: string | null;
  codigoOrg?: number;
  fatorKg?: string;
};

/**
 * Tabela de Preços PAA — Prefeitura de São João del-Rei
 * Plano Operacional 05063-2025-3162500 | Termo de Adesão 01221/2022
 * Preços vigentes e praticados. NÃO alterar sem novo plano operacional.
 */
const PAA_PRODUTOS: PaaRow[] = [
  { codigo: 1,    nome: "Abacate",                  categoria: "Frutas",      unidade: "Kg",    precoConv: "13.98", precoOrg: "18.17" },
  { codigo: 9,    nome: "Abacaxi",                  categoria: "Frutas",      unidade: "Kg",    precoConv: "7.14",  precoOrg: null },
  { codigo: 16,   nome: "Abóbora",                  categoria: "Legumes",     unidade: "Kg",    precoConv: "3.77",  precoOrg: "4.90" },
  { codigo: 41,   nome: "Abobrinha",                categoria: "Legumes",     unidade: "Kg",    precoConv: "4.88",  precoOrg: null },
  { codigo: 64,   nome: "Acelga",                   categoria: "Verduras",    unidade: "Kg",    precoConv: "15.61", precoOrg: null },
  { codigo: 67,   nome: "Acerola",                  categoria: "Frutas",      unidade: "Kg",    precoConv: "22.13", precoOrg: "28.76", codigoOrg: 68 },
  { codigo: 84,   nome: "Agrião",                   categoria: "Verduras",    unidade: "Kg",    precoConv: "18.78", precoOrg: null },
  { codigo: 97,   nome: "Alface",                   categoria: "Verduras",    unidade: "Kg",    precoConv: "13.87", precoOrg: "18.03", codigoOrg: 100 },
  { codigo: 115,  nome: "Alho",                     categoria: "Temperos",    unidade: "Kg",    precoConv: "32.45", precoOrg: null },
  { codigo: 210,  nome: "Almeirão",                 categoria: "Verduras",    unidade: "Kg",    precoConv: "13.06", precoOrg: null },
  { codigo: 705,  nome: "Arroz",                    categoria: "Grãos",       unidade: "Kg",    precoConv: "6.83",  precoOrg: null },
  { codigo: 1115, nome: "Banana",                   categoria: "Frutas",      unidade: "Kg",    precoConv: "7.02",  precoOrg: "9.12",  codigoOrg: 1120 },
  { codigo: 1138, nome: "Batata",                   categoria: "Legumes",     unidade: "Kg",    precoConv: "6.24",  precoOrg: null },
  { codigo: 1144, nome: "Batata Doce",              categoria: "Legumes",     unidade: "Kg",    precoConv: "5.76",  precoOrg: null },
  { codigo: 1162, nome: "Beterraba",                categoria: "Legumes",     unidade: "Kg",    precoConv: "5.16",  precoOrg: "6.70" },
  { codigo: 1173, nome: "Biscoito Caseiro",         categoria: "Panificados",  unidade: "Kg",   precoConv: "43.27", precoOrg: null },
  { codigo: 1209, nome: "Bolo Caseiro",             categoria: "Panificados",  unidade: "Kg",   precoConv: "27.17", precoOrg: null },
  { codigo: 1807, nome: "Cebola",                   categoria: "Legumes",     unidade: "Kg",    precoConv: "4.34",  precoOrg: null },
  { codigo: 1818, nome: "Cenoura",                  categoria: "Legumes",     unidade: "Kg",    precoConv: "4.59",  precoOrg: "5.96" },
  { codigo: 1827, nome: "Couve",                    categoria: "Verduras",    unidade: "Kg",    precoConv: "12.45", precoOrg: "16.18" },
  { codigo: 1832, nome: "Couve-Flor",               categoria: "Verduras",    unidade: "Kg",    precoConv: "10.57", precoOrg: "13.74" },
  { codigo: 1841, nome: "Doce",                     categoria: "Outros",      unidade: "Kg",    precoConv: "35.70", precoOrg: null },
  { codigo: 2147, nome: "Feijão Carioca",           categoria: "Grãos",       unidade: "Kg",    precoConv: null,    precoOrg: "11.01" },
  { codigo: 2176, nome: "Feijão",                   categoria: "Grãos",       unidade: "Kg",    precoConv: "8.47",  precoOrg: null },
  { codigo: 2261, nome: "Laranja",                  categoria: "Frutas",      unidade: "Kg",    precoConv: "9.34",  precoOrg: null },
  { codigo: 2371, nome: "Milho Verde em Espiga",    categoria: "Legumes",     unidade: "Kg",    precoConv: "10.00", precoOrg: "9.80" },
  { codigo: 2377, nome: "Pão Caseiro",              categoria: "Panificados", unidade: "Kg",    precoConv: "28.36", precoOrg: null },
  { codigo: 2470, nome: "Raiz de Mandioca (Aipim)", categoria: "Legumes",     unidade: "Kg",    precoConv: "5.22",  precoOrg: "6.78",  codigoOrg: 2465 },
  { codigo: 2525, nome: "Tomate",                   categoria: "Legumes",     unidade: "Kg",    precoConv: "11.62", precoOrg: "15.10" },
  { codigo: 2595, nome: "Vagem",                    categoria: "Legumes",     unidade: "Kg",    precoConv: "24.45", precoOrg: null },
  { codigo: 2649, nome: "Chuchu",                   categoria: "Legumes",     unidade: "Kg",    precoConv: "4.50",  precoOrg: null },
  { codigo: 2657, nome: "Coentro",                  categoria: "Temperos",    unidade: "Kg",    precoConv: "34.33", precoOrg: null },
  { codigo: 2705, nome: "Inhame",                   categoria: "Legumes",     unidade: "Kg",    precoConv: "11.15", precoOrg: "14.49" },
  { codigo: 2721, nome: "Mamão",                    categoria: "Frutas",      unidade: "Kg",    precoConv: "9.80",  precoOrg: "12.74" },
  { codigo: 2730, nome: "Manga",                    categoria: "Frutas",      unidade: "Kg",    precoConv: "9.32",  precoOrg: "12.11" },
  { codigo: 2741, nome: "Maracujá Azedo",           categoria: "Frutas",      unidade: "Kg",    precoConv: "15.48", precoOrg: null },
  { codigo: 2747, nome: "Maxixe",                   categoria: "Legumes",     unidade: "Kg",    precoConv: "12.13", precoOrg: null },
  { codigo: 2757, nome: "Ovos de Galinha",          categoria: "Outros",      unidade: "Dúzia", precoConv: "14.64", precoOrg: null, fatorKg: "0.720" },
  { codigo: 2769, nome: "Pepino",                   categoria: "Legumes",     unidade: "Kg",    precoConv: "5.99",  precoOrg: null },
  { codigo: 2775, nome: "Pimentão",                 categoria: "Legumes",     unidade: "Kg",    precoConv: "7.48",  precoOrg: null },
  { codigo: 2781, nome: "Quiabo",                   categoria: "Legumes",     unidade: "Kg",    precoConv: "13.88", precoOrg: null },
  { codigo: 2791, nome: "Ameixa",                   categoria: "Frutas",      unidade: "Kg",    precoConv: "24.31", precoOrg: "31.60" },
  { codigo: 2837, nome: "Berinjela",                categoria: "Legumes",     unidade: "Kg",    precoConv: "5.82",  precoOrg: "7.56" },
  { codigo: 2842, nome: "Brócolis",                 categoria: "Verduras",    unidade: "Kg",    precoConv: "14.97", precoOrg: "19.46" },
  { codigo: 2862, nome: "Goiaba",                   categoria: "Frutas",      unidade: "Kg",    precoConv: "14.15", precoOrg: null },
  { codigo: 2867, nome: "Jiló",                     categoria: "Legumes",     unidade: "Kg",    precoConv: "8.67",  precoOrg: null },
  { codigo: 2873, nome: "Limão",                    categoria: "Frutas",      unidade: "Kg",    precoConv: "6.76",  precoOrg: null },
  { codigo: 2879, nome: "Melancia",                 categoria: "Frutas",      unidade: "Kg",    precoConv: "3.64",  precoOrg: null },
  { codigo: 2885, nome: "Melão",                    categoria: "Frutas",      unidade: "Kg",    precoConv: "7.67",  precoOrg: null },
  { codigo: 2979, nome: "Rúcula",                   categoria: "Verduras",    unidade: "Kg",    precoConv: "22.43", precoOrg: "29.15", codigoOrg: 2977 },
  { codigo: 2994, nome: "Tangerina Ponkan",         categoria: "Frutas",      unidade: "Kg",    precoConv: "12.50", precoOrg: null },
  { codigo: 3004, nome: "Broa",                     categoria: "Panificados", unidade: "Kg",    precoConv: "26.68", precoOrg: null },
  { codigo: 3037, nome: "Cebolinha Verde",          categoria: "Temperos",    unidade: "Kg",    precoConv: "30.40", precoOrg: "39.52" },
  { codigo: 3038, nome: "Chicória",                 categoria: "Verduras",    unidade: "Kg",    precoConv: "16.16", precoOrg: null },
  { codigo: 3077, nome: "Mel de Abelha",            categoria: "Outros",      unidade: "Kg",    precoConv: "51.10", precoOrg: null },
  { codigo: 3129, nome: "Queijo Tipo Minas",        categoria: "Laticínios",  unidade: "Kg",    precoConv: "41.36", precoOrg: null },
  { codigo: 3145, nome: "Uva Niagara Rosada",       categoria: "Frutas",      unidade: "Kg",    precoConv: "21.22", precoOrg: null },
  { codigo: 3256, nome: "Espinafre",                categoria: "Verduras",    unidade: "Kg",    precoConv: "8.45",  precoOrg: "10.98" },
  { codigo: 3299, nome: "Fubá de Milho",            categoria: "Grãos",       unidade: "Kg",    precoConv: "5.92",  precoOrg: null },
  { codigo: 3313, nome: "Graviola",                 categoria: "Frutas",      unidade: "Kg",    precoConv: "17.98", precoOrg: null },
  { codigo: 3325, nome: "Iogurte",                  categoria: "Laticínios",  unidade: "Litro", precoConv: "13.68", precoOrg: null, fatorKg: "1.030" },
  { codigo: 3359, nome: "Maçã",                     categoria: "Frutas",      unidade: "Kg",    precoConv: "13.48", precoOrg: null },
  { codigo: 3424, nome: "Morango",                  categoria: "Frutas",      unidade: "Kg",    precoConv: "33.68", precoOrg: null },
  { codigo: 3428, nome: "Mostarda",                 categoria: "Verduras",    unidade: "Kg",    precoConv: "8.59",  precoOrg: "11.16" },
  { codigo: 3501, nome: "Pêssego",                  categoria: "Frutas",      unidade: "Kg",    precoConv: "22.96", precoOrg: null },
  { codigo: 3517, nome: "Pinha",                    categoria: "Frutas",      unidade: "Kg",    precoConv: "25.76", precoOrg: null },
  { codigo: 3577, nome: "Repolho",                  categoria: "Verduras",    unidade: "Kg",    precoConv: "3.96",  precoOrg: "5.14" },
  { codigo: 3588, nome: "Rosca Caseira",            categoria: "Panificados", unidade: "Kg",    precoConv: "33.03", precoOrg: null },
  { codigo: 3600, nome: "Salsa",                    categoria: "Temperos",    unidade: "Kg",    precoConv: "21.93", precoOrg: null },
  { codigo: 3666, nome: "Taioba",                   categoria: "Verduras",    unidade: "Kg",    precoConv: "14.51", precoOrg: "18.86" },
];

const dec = (v: string | null) => (v === null ? null : new Prisma.Decimal(v));

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export async function seedPaaProdutos() {
  console.log("🌾 Seed PAA — iniciando...");

  const existentes = await prisma.product.findMany({
    select: { id: true, name: true },
  });
  const porNome = new Map(existentes.map((p) => [normalize(p.name), p.id]));

  let criados = 0;
  let atualizados = 0;

  for (const row of PAA_PRODUTOS) {
    const paaData = {
      isPaa: true,
      codigoConab: row.codigo,
      codigoConabOrganico: row.codigoOrg ?? null,
      temOrganico: row.precoOrg !== null,
      paaConvencional: dec(row.precoConv),
      paaOrganico: dec(row.precoOrg),
      paaUnidade: row.unidade,
      paaFatorKg: new Prisma.Decimal(row.fatorKg ?? "1"),
    };

    // 1) já existe alguém com este codigoConab?
    const porCodigo = await prisma.product.findUnique({
      where: { codigoConab: row.codigo },
      select: { id: true },
    });

    if (porCodigo) {
      await prisma.product.update({ where: { id: porCodigo.id }, data: paaData });
      atualizados++;
      continue;
    }

    // 2) mesmo nome já cadastrado? atualiza em vez de duplicar
    const idPorNome = porNome.get(normalize(row.nome));
    if (idPorNome) {
      await prisma.product.update({ where: { id: idPorNome }, data: paaData });
      atualizados++;
      continue;
    }

    // 3) cria novo — estoque sempre em kg
    await prisma.product.create({
      data: {
        name: row.nome,
        category: row.categoria,
        unit: "kg",
        active: true,
        ...paaData,
      },
    });
    criados++;
  }

  const totalPaa = await prisma.product.count({ where: { isPaa: true } });
  console.log(`✅ Seed PAA: ${criados} criados, ${atualizados} atualizados.`);
  console.log(`📊 Total isPaa=true: ${totalPaa} (esperado: 73)`);
}

if (require.main === module) {
  seedPaaProdutos()
    .catch((e) => {
      console.error("❌ Erro no seed PAA:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

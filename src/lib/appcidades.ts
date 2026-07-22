import { normalizeCpf } from "./cpf";

// Mapa show → ID do formulário na API appcidades
export const SHOW_FORM_IDS: Record<string, number> = {
  "2026-08-13": 162, // Hugo & Guilherme (quinta)
  "2026-08-15": 163, // Daniel (sábado)
  "2026-08-16": 164, // Mariana Fagundes (domingo)
  // ❌ Ana Castela (14/08) NÃO entra na troca — apenas "Conheça seu Ídolo"
};

const BASE_URL = "https://backend.appcidades.com.br";

export interface ReservaEncontrada {
  showDia: string;
  formId: number;
  protocolo: string | null;
  nome: string | null;
  cpf: string;
  raw: unknown;
}

/** Formata 11 dígitos → 000.000.000-00 */
function formatCpf(cpf: string): string {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** Extrai a lista de respostas cobrindo todos os formatos possíveis */
function extrairLista(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  const d = data as any;
  return (
    d?.content ??
    d?.respostas ??
    d?.items ??
    d?.data?.content ??
    d?.data ??
    d?.results ??
    []
  );
}

/** Faz UMA chamada à API com o CPF no formato dado */
async function fetchRespostas(
  formId: number,
  showDia: string,
  cpfBusca: string,
  signal: AbortSignal
): Promise<any[] | null> {
  const url = `https://backend.appcidades.com.br/formularios/${formId}/respostas/filter`;

  const headers = {
    cidade: 'sao_joao_del_rei_mg',
    Authorization: `Bearer eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOi4MTczMDIwNDM0MSJ9.QdtD-wI1mnOgWi1CVwUdFsVy23EcgaZ4WF1RtUyISivsV-mBW83Qw0weQn60FnxdU_V5zEz5YFYZwJAiD35-iw`,
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({
    reset: false,
    filtroProtocoloSearch: null,
    filtroNomeSearch: null,
    filtroCpfSearch: cpfBusca,
    filtroStatusSearch: null,
    revisadaSearch: -1,
    voltouRecusaSearch: -1,
    recusadaSearch: -1,
    assinaturaCidadaoSearch: -1,
    anonimoSearch: -1,
    page: 0,
    size: 10,
    sorts: [],
    filtroPerguntaSearch: null,
    perguntaId: null,
  });

  const res = await fetch(url, {
    method: "POST",
    signal,
    headers,
    body,
  });
  console.log(res);

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    console.error(
      `[appcidades] form ${formId} (${showDia}) cpf="${cpfBusca}" → HTTP ${res.status}: ${corpo.slice(0, 300)}`
    );
    return null;
  }

  const data = await res.json();

  console.log(
    `[appcidades] form ${formId} (${showDia}) cpf="${cpfBusca}" → resposta:`,
    JSON.stringify(data).slice(0, 600)
  );

  return extrairLista(data);
}

/** Consulta UM show por CPF. Tenta CPF puro e, se vazio, formatado. */
async function consultarShow(
  formId: number,
  showDia: string,
  cpf: string
): Promise<ReservaEncontrada | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    // tentativa 1: CPF só com dígitos
    let lista = await fetchRespostas(formId, showDia, cpf, controller.signal);

    // tentativa 2: CPF formatado (fallback)
    if (!lista || lista.length === 0) {
      lista = await fetchRespostas(
        formId,
        showDia,
        formatCpf(cpf),
        controller.signal
      );
    }

    if (!Array.isArray(lista) || lista.length === 0) return null;

    const item = lista[0];
    return {
      showDia,
      formId,
      protocolo:
        item?.protocolo ??
        item?.protocoloFormatado ??
        item?.codigo ??
        item?.id ??
        null,
      nome:
        item?.nome ??
        item?.nomeCidadao ??
        item?.cidadao?.nome ??
        item?.nomeCompleto ??
        null,
      cpf,
      raw: item,
    };
  } catch (err) {
    const motivo =
      err instanceof Error && err.name === "AbortError"
        ? "timeout (8s)"
        : String(err);
    console.error(
      `[appcidades] form ${formId} (${showDia}) → falhou: ${motivo}`
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Consulta todos os shows em paralelo. Retorna todas as reservas do CPF. */
export async function buscarReservasPorCpf(
  cpfRaw: string
): Promise<ReservaEncontrada[]> {
  const cpf = normalizeCpf(cpfRaw);
  if (cpf.length !== 11) return [];

  if (!process.env.APPCIDADES_TOKEN || !process.env.APPCIDADES_CIDADE) {
    console.error(
      "[appcidades] APPCIDADES_TOKEN ou APPCIDADES_CIDADE ausente no .env"
    );
    return [];
  }
  console.log("[appcidades] token len:", process.env.APPCIDADES_TOKEN?.length);
  console.log("[appcidades] cidade:", process.env.APPCIDADES_CIDADE);
  const resultados = await Promise.all(
    Object.entries(SHOW_FORM_IDS).map(([showDia, formId]) =>
      consultarShow(formId, showDia, cpf)
    )
  );

  return resultados.filter((r): r is ReservaEncontrada => r !== null);
}

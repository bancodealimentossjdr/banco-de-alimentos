import { NextRequest, NextResponse } from 'next/server';
import { requireView } from '@/lib/auth-helpers';
import { getIndicadoresData } from '@/lib/export/indicadores-data';
import { gerarExcelIndicadores } from '@/lib/export/indicadores-excel';
import { gerarPdfIndicadores } from '@/lib/export/indicadores-pdf';

// jspdf/exceljs precisam de runtime Node (não Edge)
export const runtime = 'nodejs';
// Relatório é sempre fresco — nunca cacheado pelo Next
export const dynamic = 'force-dynamic';

const FORMATOS = ['excel', 'xlsx', 'pdf'] as const;

/** YYYY-MM-DD para o nome do arquivo. Entrada inválida não derruba o export. */
function fileDatePart(d: string | null): string {
  if (!d) return 'inicio';
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return 'inicio';
  return parsed.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // 🛡️ Onda 23.7d: era requireView('estoque') — divergia da tela que
  //    dispara o download, protegida por 'indicadores'. Quem tinha
  //    indicadores sem estoque via o botão e levava 403.
  const auth = await requireView('indicadores');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const format = (searchParams.get('format') || 'excel').toLowerCase();

  if (!FORMATOS.includes(format as (typeof FORMATOS)[number])) {
    return NextResponse.json(
      { error: `format inválido. Use: ${FORMATOS.join(', ')}` },
      { status: 400 },
    );
  }

  // 🛡️ Censura: só admin pode desligar. Backend NUNCA confia no frontend.
  //    Fail-secure — role desconhecido cai em censurado.
  const isAdmin = auth.user.role === 'admin';
  const censurar = !isAdmin || searchParams.get('mask') !== 'false';

  const baseName = `banco-de-alimentos-indicadores-${fileDatePart(
    from,
  )}-${fileDatePart(to)}-by-annonae`;

  try {
    const data = await getIndicadoresData({ from, to, censurar });

    // 📄 Onda 23.7d: o branch PDF chamava gerarExcelIndicadores e servia
    //    o XLSX com Content-Type application/pdf. Arquivo corrompido em
    //    qualquer leitor. gerarPdfIndicadores é SÍNCRONA (retorna Buffer);
    //    gerarExcelIndicadores é ASSÍNCRONA desde a 21.6.
    const isPdf = format === 'pdf';
    const buf = isPdf
      ? gerarPdfIndicadores(data)
      : await gerarExcelIndicadores(data);

    const contentType = isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    const ext = isPdf ? 'pdf' : 'xlsx';

    // 🔒 Uint8Array em vez de Buffer: evita o Response tratar o corpo como
    //    stream de objeto e corromper bytes em runtimes serverless.
    const body = new Blob([new Uint8Array(buf)], { type: contentType });

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${baseName}.${ext}"`,
        'Content-Length': String(body.size),
        'Cache-Control': 'no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[indicadores/export] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao gerar relatório.' },
      { status: 500 },
    );
  }
}

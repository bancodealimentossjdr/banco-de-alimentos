import { NextRequest, NextResponse } from 'next/server';
import { requireView } from '@/lib/auth-helpers';
import { getIndicadoresData } from '@/lib/export/indicadores-data';
import { gerarExcelIndicadores } from '@/lib/export/indicadores-excel';
import { gerarPdfIndicadores } from '@/lib/export/indicadores-pdf';

// jspdf/xlsx precisam de runtime Node (não Edge)
export const runtime = 'nodejs';

function fileDatePart(d: string | null): string {
  if (!d) return 'inicio';
  return new Date(d).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = await requireView('estoque');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const format = (searchParams.get('format') || 'excel').toLowerCase();

  // 🛡️ Censura: só admin pode desligar. Backend NUNCA confia no frontend.
  const isAdmin = auth.user.role === 'admin';
  const censurar = !isAdmin || searchParams.get('mask') !== 'false';

  const data = await getIndicadoresData({ from, to, censurar });

  const baseName = `banco-de-alimentos-indicadores-${fileDatePart(
    from,
  )}-${fileDatePart(to)}-by-annonae`;

  if (format === 'excel' || format === 'xlsx') {
    const buf = gerarExcelIndicadores(data);
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseName}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'pdf') {
    const buf = gerarPdfIndicadores(data);
    return new NextResponse(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${baseName}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  return NextResponse.json({ error: 'format inválido' }, { status: 400 });
}

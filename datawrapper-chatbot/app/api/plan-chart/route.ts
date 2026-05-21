import { NextRequest, NextResponse } from 'next/server';
import { planChart } from '@/lib/chartPlanner';
import { ColumnInfo } from '@/lib/parseData';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userPrompt,
      columns,
      preview,
      totalRows,
    }: {
      userPrompt: string;
      columns: ColumnInfo[];
      preview: Record<string, unknown>[];
      totalRows: number;
    } = body;

    if (!userPrompt || typeof userPrompt !== 'string' || !userPrompt.trim()) {
      return NextResponse.json({ error: 'userPrompt mangler' }, { status: 400 });
    }

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json(
        { error: 'Kolonnedata mangler. Last opp en fil først.' },
        { status: 400 }
      );
    }

    if (!preview || !Array.isArray(preview) || preview.length === 0) {
      return NextResponse.json(
        { error: 'Forhåndsvisningsdata mangler. Last opp en fil først.' },
        { status: 400 }
      );
    }

    const plan = await planChart(
      userPrompt.trim(),
      columns,
      preview,
      totalRows || preview.length
    );

    return NextResponse.json({ plan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ukjent feil ved planlegging';
    console.error('[/api/plan-chart]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

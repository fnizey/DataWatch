import { NextRequest, NextResponse } from 'next/server';
import { planChart, ChartPlan } from '@/lib/chartPlanner';
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
      previousPlan,
      previousChartId,
    }: {
      userPrompt: string;
      columns: ColumnInfo[];
      preview: Record<string, unknown>[];
      totalRows: number;
      previousPlan?: ChartPlan;
      previousChartId?: string;
    } = body;

    if (!userPrompt?.trim())
      return NextResponse.json({ error: 'userPrompt mangler' }, { status: 400 });
    if (!columns?.length)
      return NextResponse.json({ error: 'Last opp en fil først' }, { status: 400 });

    const plan = await planChart(
      userPrompt.trim(),
      columns,
      preview,
      totalRows || preview.length,
      { previousPlan, previousChartId }
    );

    return NextResponse.json({ plan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ukjent feil';
    console.error('[/api/plan-chart]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

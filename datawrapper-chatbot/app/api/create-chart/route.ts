import { NextRequest, NextResponse } from 'next/server';
import { createChart, uploadData, updateChartMetadata, publishChart } from '@/lib/datawrapper';
import { rowsToCsv } from '@/lib/parseData';
import { ChartPlan } from '@/lib/chartPlanner';

export const runtime = 'nodejs';
export const maxDuration = 60;

export interface ManualOverrides {
  title?: string;
  description?: string;
  source?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      plan,
      rows,
      overrides,
    }: {
      plan: ChartPlan;
      rows: Record<string, unknown>[];
      overrides?: ManualOverrides;
    } = body;

    if (!plan) return NextResponse.json({ error: 'chart-plan mangler' }, { status: 400 });
    if (!rows?.length) return NextResponse.json({ error: 'Ingen data å laste opp' }, { status: 400 });
    if (!process.env.DATAWRAPPER_API_KEY) {
      return NextResponse.json({ error: 'DATAWRAPPER_API_KEY er ikke konfigurert' }, { status: 500 });
    }

    // Manual overrides take precedence over AI-generated values
    const finalTitle       = overrides?.title?.trim()       || plan.title;
    const finalDescription = overrides?.description?.trim() || plan.description;
    const finalSource      = overrides?.source?.trim()      || plan.source;

    // ── Step 1: Create ────────────────────────────────────────────────────
    const chart = await createChart(plan.datawrapperType, finalTitle);
    const chartId = chart.id;

    // ── Step 2: Upload CSV ────────────────────────────────────────────────
    const csvData = rowsToCsv(rows, plan.xColumn, plan.yColumn, plan.seriesColumn);
    if (!csvData) return NextResponse.json({ error: 'Kunne ikke konvertere data til CSV' }, { status: 500 });
    await uploadData(chartId, csvData);

    // ── Step 3: Update metadata (title, description, source, axis, format) ─
    await updateChartMetadata(chartId, {
      title: finalTitle,
      description: finalDescription,
      source: finalSource,
      yAxisMin: plan.yAxisMin,
      yAxisMax: plan.yAxisMax,
      valueFormat: plan.valueFormat,
      yColumn: plan.yColumn,
    });

    // ── Step 4: Publish ───────────────────────────────────────────────────
    const { publicUrl, embedCode } = await publishChart(chartId);

    return NextResponse.json({
      chartId,
      url: publicUrl,
      embedCode,
      reasoning: plan.reasoning,
      plan,
      finalTitle,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ukjent feil';
    console.error('[/api/create-chart]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

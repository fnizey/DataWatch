import { NextRequest, NextResponse } from 'next/server';
import {
  createChart,
  uploadData,
  updateChartMetadata,
  publishChart,
} from '@/lib/datawrapper';
import { rowsToCsv } from '@/lib/parseData';
import { ChartPlan } from '@/lib/chartPlanner';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      plan,
      rows,
    }: {
      plan: ChartPlan;
      rows: Record<string, unknown>[];
    } = body;

    if (!plan) {
      return NextResponse.json({ error: 'chart-plan mangler' }, { status: 400 });
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Ingen data å laste opp' }, { status: 400 });
    }

    if (!process.env.DATAWRAPPER_API_KEY) {
      return NextResponse.json(
        { error: 'DATAWRAPPER_API_KEY er ikke konfigurert på serveren' },
        { status: 500 }
      );
    }

    // ── Step 1: Create chart ──────────────────────────────────────────────
    const chart = await createChart(plan.datawrapperType, plan.title);
    const chartId = chart.id;

    // ── Step 2: Prepare and upload CSV data ───────────────────────────────
    // Reorder columns so x comes first, then y – Datawrapper uses column order
    const csvData = rowsToCsv(
      rows,
      plan.xColumn,
      plan.yColumn,
      plan.seriesColumn
    );

    if (!csvData) {
      return NextResponse.json({ error: 'Kunne ikke konvertere data til CSV' }, { status: 500 });
    }

    await uploadData(chartId, csvData);

    // ── Step 3: Update metadata ───────────────────────────────────────────
    await updateChartMetadata(chartId, {
      title: plan.title,
      description: plan.description,
      source: plan.source,
      sort: plan.sort,
    });

    // ── Step 4: Publish ───────────────────────────────────────────────────
    const { publicUrl, embedCode } = await publishChart(chartId);

    return NextResponse.json({
      chartId,
      url: publicUrl,
      embedCode,
      reasoning: plan.reasoning,
      plan,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Ukjent feil ved oppretting av chart';
    console.error('[/api/create-chart]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

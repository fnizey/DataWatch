import { NextRequest, NextResponse } from 'next/server';
import { createChart, uploadData, updateChartMetadata, publishChart } from '@/lib/datawrapper';
import { rowsToCsv, pivotToWide } from '@/lib/parseData';
import { ChartPlan } from '@/lib/chartPlanner';
import Papa from 'papaparse';

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
      existingChartId,
    }: {
      plan: ChartPlan;
      rows: Record<string, unknown>[];
      overrides?: ManualOverrides;
      existingChartId?: string;
    } = body;

    if (!plan) return NextResponse.json({ error: 'chart-plan mangler' }, { status: 400 });
    if (!rows?.length) return NextResponse.json({ error: 'Ingen data' }, { status: 400 });
    if (!process.env.DATAWRAPPER_API_KEY)
      return NextResponse.json({ error: 'DATAWRAPPER_API_KEY mangler' }, { status: 500 });

    const finalTitle       = overrides?.title?.trim()       || plan.title;
    const finalDescription = overrides?.description?.trim() || plan.description;
    const finalSource      = overrides?.source?.trim()      || plan.source;

    // ── Step 1: Create OR reuse existing chart ──────────────────────────
    let chartId: string;
    if (plan.action === 'update' && existingChartId) {
      chartId = existingChartId;
    } else {
      const chart = await createChart(plan.datawrapperType, finalTitle);
      chartId = chart.id;
    }

    // ── Step 2: Prepare CSV (pivot if multi-series long format) ─────────
    let csvData: string;
    if (plan.seriesColumn) {
      // Long → wide pivot for multi-series
      const wideRows = pivotToWide(rows, plan.xColumn, plan.seriesColumn, plan.yColumn);
      csvData = Papa.unparse(wideRows);
    } else {
      csvData = rowsToCsv(rows, plan.xColumn, plan.yColumn, null);
    }

    if (!csvData) return NextResponse.json({ error: 'Kunne ikke lage CSV' }, { status: 500 });
    await uploadData(chartId, csvData);

    // ── Step 3: Update metadata ─────────────────────────────────────────
    await updateChartMetadata(chartId, {
      title: finalTitle,
      description: finalDescription,
      source: finalSource,
      yAxisMin: plan.yAxisMin,
      yAxisMax: plan.yAxisMax,
      valueFormat: plan.valueFormat,
      yColumn: plan.yColumn,
    });

    // ── Step 4: Publish ─────────────────────────────────────────────────
    const { publicUrl, embedCode } = await publishChart(chartId);

    return NextResponse.json({
      chartId,
      url: publicUrl,
      embedCode,
      reasoning: plan.reasoning,
      plan,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ukjent feil';
    console.error('[/api/create-chart]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

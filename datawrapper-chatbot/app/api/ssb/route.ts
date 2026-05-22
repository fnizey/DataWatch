import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SSB_BASE = 'https://data.ssb.no/api/v0/no/table';

interface JsonStatDataset {
  class: string;
  label: string;
  source: string;
  updated: string;
  id: string[];
  size: number[];
  dimension: Record<string, {
    label: string;
    category: {
      index: Record<string, number>;
      label: Record<string, string>;
    };
  }>;
  value: (number | null)[];
}

function parseJsonStat(data: JsonStatDataset): Record<string, unknown>[] {
  const { id, dimension, value } = data;

  // Build ordered category arrays per dimension
  const dimCategories = id.map(dimId => {
    const cat = dimension[dimId].category;
    return Object.entries(cat.index)
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => ({ key, label: cat.label[key] || key }));
  });

  // Cartesian product
  function cartesian(arrays: {key:string;label:string}[][]): {key:string;label:string}[][] {
    return arrays.reduce<{key:string;label:string}[][]>(
      (acc, arr) => acc.flatMap(x => arr.map(y => [...x, y])),
      [[]]
    );
  }

  const combinations = cartesian(dimCategories);

  return combinations.map((combo, i) => {
    const row: Record<string, unknown> = {};
    id.forEach((dimId, d) => {
      row[dimension[dimId].label || dimId] = combo[d].label;
    });
    row['verdi'] = value[i] ?? null;
    return row;
  }).filter(row => row['verdi'] !== null);
}

// GET /api/ssb?action=search&q=keyword
// GET /api/ssb?action=metadata&table=07129
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const q = searchParams.get('q');
  const table = searchParams.get('table');

  try {
    if (action === 'search' && q) {
      const res = await fetch(`${SSB_BASE}/?query=${encodeURIComponent(q)}&outputLanguage=no`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`SSB søk feilet: ${res.status}`);
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === 'metadata' && table) {
      const res = await fetch(`${SSB_BASE}/${table}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`SSB metadata feilet: ${res.status}`);
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SSB API-feil';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/ssb?action=data&table=07129
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table');

  if (!table) return NextResponse.json({ error: 'table-parameter mangler' }, { status: 400 });

  try {
    // First fetch metadata to find time dimension
    const metaRes = await fetch(`${SSB_BASE}/${table}`, { headers: { Accept: 'application/json' } });
    if (!metaRes.ok) throw new Error(`Fant ikke SSB-tabell ${table}`);
    const meta = await metaRes.json();

    const variables: { code: string; text: string; values: string[]; valueTexts: string[] }[] = meta.variables || [];

    // Build query: latest 12 for time dims, all for others
    const query = variables.map(v => {
      const isTime = /^(tid|year|kvartal|måned|month|quarter)/i.test(v.code) ||
                     /^(tid|year|kvartal|måned)/i.test(v.text);
      if (isTime) {
        const latest = v.values.slice(-12);
        return { code: v.code, selection: { filter: 'item', values: latest } };
      }
      // Limit to 20 values max to avoid huge responses
      const vals = v.values.slice(0, 20);
      return { code: v.code, selection: { filter: 'item', values: vals } };
    });

    const body = { query, response: { format: 'json-stat2' } };

    const dataRes = await fetch(`${SSB_BASE}/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    if (!dataRes.ok) {
      const errText = await dataRes.text();
      throw new Error(`SSB data-henting feilet: ${errText.slice(0, 200)}`);
    }

    const dataset = await dataRes.json() as JsonStatDataset;
    const rows = parseJsonStat(dataset);

    if (rows.length === 0) throw new Error('Ingen data returnert fra SSB');

    return NextResponse.json({
      rows,
      label: dataset.label,
      source: dataset.source || 'SSB',
      updated: dataset.updated,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SSB API-feil';
    console.error('[/api/ssb]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

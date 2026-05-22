import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SSB_BASE = 'https://data.ssb.no/api/v0/no/table';

interface JsonStatDataset {
  label: string;
  source: string;
  updated: string;
  id: string[];
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

  const dimCategories = id.map(dimId => {
    const cat = dimension[dimId].category;
    return Object.entries(cat.index)
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => ({ key, label: cat.label[key] || key }));
  });

  function cartesian(arrays: { key: string; label: string }[][]): { key: string; label: string }[][] {
    return arrays.reduce<{ key: string; label: string }[][]>(
      (acc, arr) => acc.flatMap(x => arr.map(y => [...x, y])),
      [[]]
    );
  }

  const combinations = cartesian(dimCategories);

  return combinations
    .map((combo, i) => {
      const row: Record<string, unknown> = {};
      id.forEach((dimId, d) => {
        row[dimension[dimId].label || dimId] = combo[d].label;
      });
      row['verdi'] = value[i] ?? null;
      return row;
    })
    .filter(row => row['verdi'] !== null);
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
      return NextResponse.json(await res.json());
    }

    if (action === 'metadata' && table) {
      const res = await fetch(`${SSB_BASE}/${table}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`SSB tabell ${table} ikke funnet`);
      return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'SSB feil' }, { status: 500 });
  }
}

// POST /api/ssb?action=data&table=07129
// Body: { selections: [{ code, filter, values }] }
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table');
  if (!table) return NextResponse.json({ error: 'table mangler' }, { status: 400 });

  try {
    const body = await request.json();
    const selections: { code: string; filter: string; values: string[] }[] = body.selections || [];

    const ssbQuery = {
      query: selections.map(s => ({
        code: s.code,
        selection: { filter: s.filter, values: s.values },
      })),
      response: { format: 'json-stat2' },
    };

    const dataRes = await fetch(`${SSB_BASE}/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(ssbQuery),
    });

    if (!dataRes.ok) {
      const errText = await dataRes.text();
      throw new Error(`SSB data feilet: ${errText.slice(0, 300)}`);
    }

    const dataset = await dataRes.json() as JsonStatDataset;
    const rows = parseJsonStat(dataset);
    if (rows.length === 0) throw new Error('Ingen data returnert fra SSB. Prøv et annet utvalg.');

    return NextResponse.json({ rows, label: dataset.label, source: dataset.source || 'SSB', updated: dataset.updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SSB API-feil';
    console.error('[/api/ssb]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

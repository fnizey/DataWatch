import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

const SSB_BASE = 'https://data.ssb.no/api/v0/no/table';

interface JsonStatDataset {
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

/**
 * Robust JSON-stat2 parser.
 *
 * SSB returns a flat value[] array where the position of a combination
 * (i0, i1, ..., iN) is:
 *   pos = i0*stride0 + i1*stride1 + ... + iN
 * where stride[d] = product of sizes of all dimensions after d.
 *
 * We use the ACTUAL category.index values from the response (not our
 * sequential array position) to compute pos correctly, handling any
 * non-sequential or non-zero-based indices SSB might return.
 */
function parseJsonStat(data: JsonStatDataset): Record<string, unknown>[] {
  const { id, dimension, value } = data;

  // Build ordered category lists, sorted by their index value
  const dimCategories = id.map(dimId => {
    const cat = dimension[dimId].category;
    return Object.entries(cat.index)
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => ({ key, label: cat.label[key] || key }));
  });

  // Calculate strides from ACTUAL category counts (safer than trusting size[])
  const strides = id.map((_, d) => {
    let s = 1;
    for (let j = d + 1; j < id.length; j++) s *= dimCategories[j].length;
    return s;
  });

  const rows: Record<string, unknown>[] = [];

  function recurse(
    d: number,
    combo: { key: string; label: string }[],
    pos: number
  ) {
    if (d === id.length) {
      const val = value[pos];
      if (val === null || val === undefined) return;
      const row: Record<string, unknown> = {};
      id.forEach((dimId, i) => {
        row[dimension[dimId].label || dimId] = combo[i].label;
      });
      row['verdi'] = val;
      rows.push(row);
      return;
    }

    dimCategories[d].forEach((cat, seqIdx) => {
      // Use sequential index (0,1,2,...) consistent with our stride calculation
      recurse(d + 1, [...combo, cat], pos + seqIdx * strides[d]);
    });
  }

  recurse(0, [], 0);
  return rows;
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
      const res = await fetch(
        `${SSB_BASE}/?query=${encodeURIComponent(q)}&outputLanguage=no`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) throw new Error(`SSB søk feilet: ${res.status}`);
      return NextResponse.json(await res.json());
    }

    if (action === 'metadata' && table) {
      const res = await fetch(`${SSB_BASE}/${table}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`SSB tabell ${table} ikke funnet (HTTP ${res.status})`);
      return NextResponse.json(await res.json());
    }

    return NextResponse.json({ error: 'Ugyldig forespørsel' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'SSB feil' },
      { status: 500 }
    );
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
    const selections: { code: string; filter: string; values: string[] }[] =
      body.selections || [];

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

    // Sanity check: total cells should match value array length
    const expectedCells = dataset.id.reduce((acc, dimId) => {
      return acc * Object.keys(dataset.dimension[dimId].category.index).length;
    }, 1);

    if (dataset.value.length !== expectedCells) {
      console.warn(
        `SSB verdi-array lengde (${dataset.value.length}) matcher ikke forventet (${expectedCells}). Tabell: ${table}`
      );
    }

    const rows = parseJsonStat(dataset);

    if (rows.length === 0) {
      throw new Error(
        'Ingen data returnert fra SSB. Prøv et annet utvalg – merk at noen kombinasjoner kan mangle verdier.'
      );
    }

    return NextResponse.json({
      rows,
      label: dataset.label,
      source: dataset.source || 'SSB',
      updated: dataset.updated,
      totalCells: dataset.value.length,
      nonNullRows: rows.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SSB API-feil';
    console.error('[/api/ssb]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

'use client';

import { useState } from 'react';
import { UploadResult } from './FileUpload';

interface SSBSearchProps {
  onDataLoaded: (result: UploadResult) => void;
  isLoading: boolean;
}

interface SSBTable { id: string; title: string; }

interface SSBVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  elimination?: boolean;
  time?: boolean;
}

interface DimSelection {
  code: string;
  text: string;
  filter: 'top' | 'item';
  topN: number;
  selectedValues: Set<string>;
  allValues: { value: string; text: string }[];
  isTime: boolean;
  search: string;
}

function isTimeDim(code: string, text: string): boolean {
  return /^(tid|year|aar|kvartal|måned|month|quarter)/i.test(code) ||
         /^(tid|år|kvartal|måned)/i.test(text);
}

function countCombinations(dims: DimSelection[]): number {
  return dims.reduce((acc, d) => {
    const n = d.filter === 'top' ? Math.min(d.topN, d.allValues.length) : d.selectedValues.size;
    return acc * Math.max(1, n);
  }, 1);
}

export default function SSBSearch({ onDataLoaded, isLoading }: SSBSearchProps) {
  const [query, setQuery] = useState('');
  const [tableId, setTableId] = useState('');
  const [results, setResults] = useState<SSBTable[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<SSBTable | null>(null);
  const [dims, setDims] = useState<DimSelection[]>([]);
  const [view, setView] = useState<'search' | 'configure'>('search');

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true); setError(null); setResults([]);
    try {
      const res = await fetch(`/api/ssb?action=search&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(Array.isArray(data) ? data.slice(0, 10) : []);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Søk feilet'); }
    finally { setSearching(false); }
  }

  async function loadTable(table: SSBTable) {
    setActiveTable(table); setLoadingMeta(true); setError(null);
    try {
      const res = await fetch(`/api/ssb?action=metadata&table=${table.id}`);
      const meta = await res.json();
      if (!res.ok) throw new Error(meta.error);

      const variables: SSBVariable[] = meta.variables || [];
      const newDims: DimSelection[] = variables.map(v => {
        const isTime = isTimeDim(v.code, v.text);
        const allValues = v.values.map((val, i) => ({ value: val, text: v.valueTexts[i] || val }));
        return {
          code: v.code,
          text: v.text,
          filter: isTime ? 'top' : 'item',
          topN: 10,
          selectedValues: isTime ? new Set() : new Set(allValues.slice(0, 20).map(v => v.value)),
          allValues,
          isTime,
          search: '',
        };
      });

      setDims(newDims);
      setView('configure');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Metadata feilet'); setActiveTable(null); }
    finally { setLoadingMeta(false); }
  }

  async function fetchData() {
    if (!activeTable) return;
    setFetching(true); setError(null);

    const selections = dims.map(d => ({
      code: d.code,
      filter: d.filter,
      values: d.filter === 'top'
        ? [String(d.topN)]
        : Array.from(d.selectedValues),
    }));

    try {
      const res = await fetch(`/api/ssb?action=data&table=${activeTable.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const rows: Record<string, unknown>[] = data.rows;
      if (!rows?.length) throw new Error('Ingen data');

      const colNames = Object.keys(rows[0]);
      const columns = colNames.map(name => {
        const vals = rows.map(r => String(r[name] ?? ''));
        const isNum = vals.filter(v => !isNaN(Number(v.replace(',', '.')))).length / vals.length > 0.8;
        return { name, type: isNum ? 'numeric' : 'categorical', sample: vals.slice(0, 5) };
      });

      onDataLoaded({ columns, rows, totalRows: rows.length, preview: rows.slice(0, 10), fileName: `SSB ${activeTable.id}` });
      setView('search');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Henting feilet'); }
    finally { setFetching(false); }
  }

  function updateDim(code: string, update: Partial<DimSelection>) {
    setDims(prev => prev.map(d => d.code === code ? { ...d, ...update } : d));
  }

  function toggleValue(code: string, value: string) {
    setDims(prev => prev.map(d => {
      if (d.code !== code) return d;
      const next = new Set(d.selectedValues);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...d, selectedValues: next };
    }));
  }

  const totalCombinations = countCombinations(dims);
  const tooLarge = totalCombinations > 5000;
  const busy = searching || loadingMeta || fetching || isLoading;

  if (view === 'configure' && activeTable) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button onClick={() => setView('search')} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-800 truncate">{activeTable.title.replace(/^\d+:\s*/, '').slice(0, 50)}</p>
            <p className="text-[10px] text-gray-400 font-mono">{activeTable.id}</p>
          </div>
        </div>

        {loadingMeta ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 py-4">
            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Henter dimensjoner…
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {dims.map(dim => {
              const filtered = dim.allValues.filter(v =>
                !dim.search || v.text.toLowerCase().includes(dim.search.toLowerCase()) || v.value.includes(dim.search)
              );

              return (
                <div key={dim.code} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700">{dim.text}</p>
                    {dim.isTime ? (
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Tid</span>
                    ) : (
                      <span className="text-[10px] text-gray-400">{dim.selectedValues.size}/{dim.allValues.length} valgt</span>
                    )}
                  </div>

                  {dim.isTime ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Siste</span>
                      <select
                        value={dim.topN}
                        onChange={e => updateDim(dim.code, { topN: parseInt(e.target.value) })}
                        className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-accent"
                      >
                        {[1, 3, 5, 10, 20, 50].filter(n => n <= dim.allValues.length).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                        <option value={dim.allValues.length}>Alle ({dim.allValues.length})</option>
                      </select>
                      <span className="text-xs text-gray-500">perioder</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {/* Search within dim */}
                      {dim.allValues.length > 10 && (
                        <input
                          type="text"
                          value={dim.search}
                          onChange={e => updateDim(dim.code, { search: e.target.value })}
                          placeholder="Filtrer…"
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-accent"
                        />
                      )}

                      {/* Select all / none */}
                      <div className="flex gap-2">
                        <button onClick={() => updateDim(dim.code, { selectedValues: new Set(dim.allValues.map(v => v.value)) })}
                          className="text-[10px] text-accent hover:underline">Velg alle</button>
                        <span className="text-gray-300">·</span>
                        <button onClick={() => updateDim(dim.code, { selectedValues: new Set() })}
                          className="text-[10px] text-gray-400 hover:underline">Fjern alle</button>
                      </div>

                      {/* Value list */}
                      <div className="max-h-36 overflow-y-auto space-y-0.5">
                        {filtered.slice(0, 100).map(v => (
                          <label key={v.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded group">
                            <div onClick={() => toggleValue(dim.code, v.value)}
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${dim.selectedValues.has(v.value) ? 'bg-accent border-accent' : 'border-gray-300 group-hover:border-accent'}`}>
                              {dim.selectedValues.has(v.value) && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-xs text-gray-600 truncate" onClick={() => toggleValue(dim.code, v.value)}>{v.text}</span>
                          </label>
                        ))}
                        {filtered.length > 100 && (
                          <p className="text-[10px] text-gray-400 px-1">+{filtered.length - 100} til — bruk søkefeltet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Combination count warning */}
        {!loadingMeta && (
          <div className={`text-xs px-3 py-2 rounded-lg ${tooLarge ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-50 text-gray-500'}`}>
            {tooLarge
              ? `⚠️ For mange kombinasjoner (${totalCombinations.toLocaleString('no-NO')}). Begrens utvalget.`
              : `~${totalCombinations.toLocaleString('no-NO')} datapunkter`
            }
          </div>
        )}

        <button
          onClick={fetchData}
          disabled={busy || tooLarge || loadingMeta}
          className="w-full py-2.5 bg-accent text-white text-sm font-semibold rounded-xl hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {fetching ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Henter data…</>) : '🇳🇴 Hent data fra SSB'}
        </button>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
            <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 18.333 3.924 20 5.464 20z" /></svg>
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Direct ID */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tabell-ID</p>
        <div className="flex gap-2">
          <input type="text" value={tableId} onChange={e => setTableId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadTable({ id: tableId.trim(), title: `Tabell ${tableId.trim()}` })}
            placeholder="f.eks. 09189" disabled={busy}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent placeholder:text-gray-400" />
          <button onClick={() => loadTable({ id: tableId.trim(), title: `Tabell ${tableId.trim()}` })}
            disabled={!tableId.trim() || busy}
            className="px-3 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-dark disabled:opacity-40 transition-colors">
            Velg
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Finn ID på <a href="https://www.ssb.no/statbank" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">ssb.no/statbank</a></p>
      </div>

      {/* Search */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Søk</p>
        <div className="flex gap-2">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="arbeidsledighet, BNP, befolkning…" disabled={busy}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent placeholder:text-gray-400" />
          <button onClick={handleSearch} disabled={!query.trim() || busy}
            className="px-3 py-2 bg-gray-800 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors">
            {searching ? '…' : 'Søk'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map(t => (
            <button key={t.id} onClick={() => loadTable(t)} disabled={busy}
              className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200 hover:border-accent hover:bg-accent/5 transition-colors text-xs disabled:opacity-50">
              <span className="font-mono text-gray-400 mr-2">{t.id}</span>
              <span className="font-medium text-gray-700 line-clamp-1">{t.title.replace(/^\d+:\s*/, '')}</span>
            </button>
          ))}
        </div>
      )}

      {(searching || loadingMeta) && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          {loadingMeta ? 'Henter dimensjoner…' : 'Søker…'}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 18.333 3.924 20 5.464 20z" /></svg>
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

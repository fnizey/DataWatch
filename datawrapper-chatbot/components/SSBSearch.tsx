'use client';

import { useState } from 'react';
import { UploadResult } from './FileUpload';

interface SSBSearchProps {
  onDataLoaded: (result: UploadResult) => void;
  isLoading: boolean;
}

interface SSBTable {
  id: string;
  title: string;
  updated?: string;
}

export default function SSBSearch({ onDataLoaded, isLoading }: SSBSearchProps) {
  const [query, setQuery] = useState('');
  const [tableId, setTableId] = useState('');
  const [results, setResults] = useState<SSBTable[]>([]);
  const [searching, setSearching] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTable, setActiveTable] = useState<SSBTable | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(`/api/ssb?action=search&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'SSB-søk feilet');
    } finally {
      setSearching(false);
    }
  }

  async function fetchTable(table: SSBTable) {
    setActiveTable(table);
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/ssb?action=data&table=${table.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const rows: Record<string, unknown>[] = data.rows;
      if (!rows?.length) throw new Error('Ingen data returnert');

      const colNames = Object.keys(rows[0]);
      const columns = colNames.map(name => {
        const vals = rows.map(r => String(r[name] ?? ''));
        const isNum = vals.filter(v => !isNaN(Number(v.replace(',', '.')))).length / vals.length > 0.8;
        return { name, type: isNum ? 'numeric' : 'categorical', sample: vals.slice(0, 5) };
      });

      onDataLoaded({
        columns,
        rows,
        totalRows: rows.length,
        preview: rows.slice(0, 10),
        fileName: `SSB ${table.id} – ${table.title.slice(0, 40)}`,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Henting feilet');
      setActiveTable(null);
    } finally {
      setFetching(false);
    }
  }

  async function fetchById() {
    const id = tableId.trim();
    if (!id) return;
    await fetchTable({ id, title: `Tabell ${id}` });
  }

  const busy = searching || fetching || isLoading;

  return (
    <div className="space-y-4">
      {/* Direct table ID */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Tabell-ID</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={tableId}
            onChange={e => setTableId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchById()}
            placeholder="f.eks. 07129"
            disabled={busy}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent placeholder:text-gray-400"
          />
          <button
            onClick={fetchById}
            disabled={!tableId.trim() || busy}
            className="px-3 py-2 bg-accent text-white text-xs font-semibold rounded-lg hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Hent
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">Finn ID på <a href="https://www.ssb.no/statbank" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">ssb.no/statbank</a></p>
      </div>

      {/* Keyword search */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Søk etter tabell</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="f.eks. arbeidsledighet, BNP, befolkning"
            disabled={busy}
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent placeholder:text-gray-400"
          />
          <button
            onClick={handleSearch}
            disabled={!query.trim() || busy}
            className="px-3 py-2 bg-gray-800 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {searching ? '…' : 'Søk'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map(t => (
            <button
              key={t.id}
              onClick={() => fetchTable(t)}
              disabled={busy}
              className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors text-xs
                ${activeTable?.id === t.id
                  ? 'border-accent bg-accent/5 text-accent'
                  : 'border-gray-200 hover:border-accent hover:bg-accent/5 text-gray-700'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="font-mono text-gray-400 mr-2">{t.id}</span>
              <span className="font-medium line-clamp-1">{t.title.replace(/^\d+:\s*/, '')}</span>
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {(searching || fetching) && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          {fetching ? `Henter data fra SSB${activeTable ? ` (${activeTable.id})` : ''}…` : 'Søker i SSB…'}
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

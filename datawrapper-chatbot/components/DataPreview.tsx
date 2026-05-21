'use client';

import { UploadResult } from './FileUpload';

interface DataPreviewProps {
  data: UploadResult;
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  date:        { label: 'Dato',        icon: '📅', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  numeric:     { label: 'Tall',        icon: '#',  color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  geographic:  { label: 'Geografi',    icon: '📍', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  categorical: { label: 'Kategori',    icon: 'T',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
};

export default function DataPreview({ data }: DataPreviewProps) {
  const { columns, preview, totalRows, fileName } = data;

  return (
    <div className="space-y-4">
      {/* File info header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-gray-800 truncate">{fileName}</span>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full shrink-0">
          {totalRows.toLocaleString('no-NO')} rader
        </span>
      </div>

      {/* Column type badges */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Kolonner ({columns.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((col) => {
            const cfg = TYPE_CONFIG[col.type] ?? TYPE_CONFIG.categorical;
            return (
              <span
                key={col.name}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${cfg.color}`}
                title={`${col.name} — ${cfg.label}`}
              >
                <span className="font-mono text-[10px]">{cfg.icon}</span>
                <span className="truncate max-w-[100px]">{col.name}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Data preview table */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Forhåndsvisning (første {Math.min(10, preview.length)} rader)
        </p>
        <div className="overflow-auto rounded-lg border border-gray-200 max-h-64">
          <table className="preview-table">
            <thead>
              <tr>
                {columns.map((col) => {
                  const cfg = TYPE_CONFIG[col.type] ?? TYPE_CONFIG.categorical;
                  return (
                    <th key={col.name} className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-mono text-[10px] opacity-60">{cfg.icon}</span>
                        {col.name}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.name} title={String(row[col.name] ?? '')}>
                      {String(row[col.name] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

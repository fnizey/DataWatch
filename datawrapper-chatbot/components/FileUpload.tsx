'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';

interface FileUploadProps {
  onUpload: (result: UploadResult) => void;
  isLoading: boolean;
}

export interface UploadResult {
  columns: { name: string; type: string; sample: string[] }[];
  rows: Record<string, unknown>[];
  totalRows: number;
  preview: Record<string, unknown>[];
  fileName: string;
}

export default function FileUpload({ onUpload, isLoading }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function processFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'xls', 'xlsx'].includes(ext)) {
      setError(`Filformat '${ext}' støttes ikke. Bruk .csv, .xls eller .xlsx`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Filen er for stor. Maks 10 MB.');
      return;
    }

    setError(null);
    setUploading(true);
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Opplasting feilet');
      }

      onUpload(data as UploadResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Opplasting feilet';
      setError(message);
      setFileName(null);
    } finally {
      setUploading(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  const busy = uploading || isLoading;

  return (
    <div className="space-y-3">
      <div
        onClick={() => !busy && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200 select-none
          ${isDragging
            ? 'border-accent bg-red-50 scale-[1.01]'
            : fileName
            ? 'border-green-400 bg-green-50'
            : 'border-gray-200 bg-gray-50 hover:border-accent hover:bg-red-50'
          }
          ${busy ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          className="hidden"
          onChange={handleFileChange}
          disabled={busy}
        />

        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-1">
              <span className="loading-dot w-2 h-2 bg-accent rounded-full inline-block" />
              <span className="loading-dot w-2 h-2 bg-accent rounded-full inline-block" />
              <span className="loading-dot w-2 h-2 bg-accent rounded-full inline-block" />
            </div>
            <p className="text-sm text-gray-500 font-medium">Analyserer datasett…</p>
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-green-700 truncate max-w-[200px]">{fileName}</p>
            <p className="text-xs text-gray-400">Klikk for å bytte fil</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Dra hit eller <span className="text-accent">velg fil</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">CSV, XLS eller XLSX · Maks 10 MB</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg">
          <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 18.333 3.924 20 5.464 20z" />
          </svg>
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

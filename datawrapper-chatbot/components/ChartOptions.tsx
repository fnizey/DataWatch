'use client';

import { useState } from 'react';

export interface ChartOverrides {
  title?: string;
  description?: string;
  source?: string;
}

interface FieldToggleProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}

function FieldToggle({ label, placeholder, value, onChange, multiline }: FieldToggleProps) {
  const [enabled, setEnabled] = useState(false);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    if (!next) onChange(''); // clear value when disabled
  }

  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-2.5 cursor-pointer group">
        {/* Custom checkbox */}
        <button
          type="button"
          onClick={handleToggle}
          className={`
            w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${enabled
              ? 'bg-accent border-accent'
              : 'bg-white border-gray-300 group-hover:border-accent'
            }
          `}
        >
          {enabled && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className={`text-xs font-medium transition-colors ${enabled ? 'text-gray-800' : 'text-gray-500'}`}>
          {label}
        </span>
      </label>

      {enabled && (
        <div className="ml-6">
          {multiline ? (
            <textarea
              rows={2}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent resize-none bg-white placeholder:text-gray-400"
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent bg-white placeholder:text-gray-400"
              autoFocus
            />
          )}
        </div>
      )}
    </div>
  );
}

interface ChartOptionsProps {
  onChange: (overrides: ChartOverrides) => void;
}

export default function ChartOptions({ onChange }: ChartOptionsProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');

  function update(field: keyof ChartOverrides, value: string) {
    const next = { title, description, source, [field]: value };
    setTitle(next.title);
    setDescription(next.description);
    setSource(next.source);
    // Only pass non-empty values as overrides
    onChange({
      ...(next.title.trim() ? { title: next.title.trim() } : {}),
      ...(next.description.trim() ? { description: next.description.trim() } : {}),
      ...(next.source.trim() ? { source: next.source.trim() } : {}),
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center">
          <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-800">Manuelt overstyring</h2>
          <p className="text-[11px] text-gray-400">Huk av for å overstyre AI-forslag</p>
        </div>
      </div>

      <div className="space-y-3">
        <FieldToggle
          label="Tittel"
          placeholder="Skriv din egen tittel…"
          value={title}
          onChange={(v) => update('title', v)}
        />
        <FieldToggle
          label="Ingress / beskrivelse"
          placeholder="Kort ingress under tittelen…"
          value={description}
          onChange={(v) => update('description', v)}
          multiline
        />
        <FieldToggle
          label="Kilde"
          placeholder="f.eks. SSB, NVE, Norges Bank…"
          value={source}
          onChange={(v) => update('source', v)}
        />
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Tomme felt fylles automatisk av AI basert på datasettet og prompten din.
          Spesifiser detaljer som y-akse og desimaler direkte i chatten:
          <span className="block mt-1 text-gray-500 italic">
            "sett y-akse fra 0 til 100" · "vis to desimaler"
          </span>
        </p>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

export interface ChartOverrides {
  title?: string;
  description?: string;
  source?: string;
  baseColor?: string;
  showLabels?: boolean;
  referenceLineValue?: number | null;
  referenceLineLabel?: string;
  notes?: string;
}

const PRESET_COLORS = ['#E63946','#457B9D','#2A9D8F','#E9C46A','#F4A261','#264653','#6A4C93','#1D3557'];

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center gap-2.5 group cursor-pointer">
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-accent border-accent' : 'bg-white border-gray-300 group-hover:border-accent'}`}>
        {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span className={`text-xs font-medium transition-colors ${checked ? 'text-gray-800' : 'text-gray-500'}`}>{label}</span>
    </button>
  );
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
  return (
    <div className="space-y-1.5">
      <Toggle label={label} checked={enabled} onChange={v => { setEnabled(v); if (!v) onChange(''); }} />
      {enabled && (
        <div className="ml-6">
          {multiline
            ? <textarea rows={2} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent resize-none bg-white placeholder:text-gray-400" autoFocus />
            : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-accent bg-white placeholder:text-gray-400" autoFocus />
          }
        </div>
      )}
    </div>
  );
}

export default function ChartOptions({ onChange }: { onChange: (o: ChartOverrides) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [baseColor, setBaseColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showLabelsEnabled, setShowLabelsEnabled] = useState(false);
  const [refValue, setRefValue] = useState('');
  const [refLabel, setRefLabel] = useState('');
  const [showRefLine, setShowRefLine] = useState(false);
  const [notes, setNotes] = useState('');

  function emit(overrides: Partial<ChartOverrides>) {
    onChange({
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(source.trim() ? { source: source.trim() } : {}),
      ...(baseColor ? { baseColor } : {}),
      ...(showLabelsEnabled ? { showLabels } : {}),
      ...(showRefLine && refValue ? { referenceLineValue: parseFloat(refValue), referenceLineLabel: refLabel } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...overrides,
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center">
          <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-800">Innstillinger</h2>
          <p className="text-[11px] text-gray-400">Huk av for å overstyre AI</p>
        </div>
      </div>

      {/* Text overrides */}
      <div className="space-y-3">
        <FieldToggle label="Tittel" placeholder="Din tittel…" value={title} onChange={v => { setTitle(v); emit({ title: v.trim() || undefined }); }} />
        <FieldToggle label="Ingress" placeholder="Kort ingress…" value={description} onChange={v => { setDescription(v); emit({ description: v.trim() || undefined }); }} multiline />
        <FieldToggle label="Kilde" placeholder="SSB, NVE, Norges Bank…" value={source} onChange={v => { setSource(v); emit({ source: v.trim() || undefined }); }} />
        <FieldToggle label="Fotnote / noter" placeholder="Tekst under chartet…" value={notes} onChange={v => { setNotes(v); emit({ notes: v.trim() || undefined }); }} multiline />
      </div>

      <div className="border-t border-gray-100 pt-3 space-y-3">
        {/* Color picker */}
        <Toggle label="Velg farge" checked={showColorPicker} onChange={v => { setShowColorPicker(v); if (!v) { setBaseColor(''); emit({ baseColor: undefined }); } }} />
        {showColorPicker && (
          <div className="ml-6 space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => { setBaseColor(c); emit({ baseColor: c }); }}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${baseColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }} />
              ))}
              <input type="color" value={baseColor || '#E63946'} onChange={e => { setBaseColor(e.target.value); emit({ baseColor: e.target.value }); }}
                className="w-6 h-6 rounded-full border border-gray-200 cursor-pointer overflow-hidden p-0" title="Egendefinert farge" />
            </div>
            {baseColor && <p className="text-[10px] text-gray-400 font-mono">{baseColor}</p>}
          </div>
        )}

        {/* Data labels */}
        <Toggle label="Dataetiketter på stolper" checked={showLabelsEnabled} onChange={v => { setShowLabelsEnabled(v); if (v) { setShowLabels(true); emit({ showLabels: true }); } else { emit({ showLabels: undefined }); } }} />
        {showLabelsEnabled && (
          <div className="ml-6 flex gap-2">
            <button type="button" onClick={() => { setShowLabels(true); emit({ showLabels: true }); }}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${showLabels ? 'bg-accent text-white border-accent' : 'border-gray-200 text-gray-600 hover:border-accent'}`}>
              På
            </button>
            <button type="button" onClick={() => { setShowLabels(false); emit({ showLabels: false }); }}
              className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${!showLabels ? 'bg-accent text-white border-accent' : 'border-gray-200 text-gray-600 hover:border-accent'}`}>
              Av
            </button>
          </div>
        )}

        {/* Reference line */}
        <Toggle label="Referanselinje" checked={showRefLine} onChange={v => { setShowRefLine(v); if (!v) emit({ referenceLineValue: undefined }); }} />
        {showRefLine && (
          <div className="ml-6 flex gap-2">
            <input type="number" value={refValue} onChange={e => { setRefValue(e.target.value); emit({ referenceLineValue: e.target.value ? parseFloat(e.target.value) : null }); }}
              placeholder="Verdi" className="w-24 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent" />
            <input type="text" value={refLabel} onChange={e => { setRefLabel(e.target.value); emit({ referenceLineLabel: e.target.value }); }}
              placeholder="Etikett (valgfritt)" className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-accent" />
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed pt-1">
        Y-akse og desimaler: skriv direkte i chatten.<br />
        <span className="italic">"sett y-akse 0–100" · "vis to desimaler"</span>
      </p>
    </div>
  );
}

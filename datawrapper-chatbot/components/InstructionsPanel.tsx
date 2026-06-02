'use client';

import { useState } from 'react';

const CLEAN_PROMPT = `Du er en datastruktureringsassistent for journalister. Brukeren laster opp en Excel- eller CSV-fil som skal renses og struktureres for bruk i Datawrapper.

OPPGAVE:
Analyser filen og lever tilbake en ren, strukturert CSV-fil klar for Datawrapper.

REGLER FOR OUTPUT-FILEN:
1. Første og eneste headerrad = kolonnenavn
   - Korte navn (maks 30 tegn)
   - Ingen spesialtegn unntatt understrek
   - Eksempel: "bank_navn", "nim_prosent", "aar"

2. Én rad = én observasjon, ingen unntak
   - Fjern tittelrader øverst
   - Fjern tomme rader
   - Fjern fotnoter, kontaktinfo og kommentarer nederst

3. Datoformater → konverter til ISO:
   - "01.01.2024" → "2024-01-01"
   - "januar 2024" → "2024-01-01"
   - "2024M01" → "2024-01"
   - "Q1 2024" → "2024-01-01"
   - Kun årstall "2024" → behold som "2024"

4. Tallkolonner:
   - Fjern enheter fra celler ("1 234 mill. kr" → "1234")
   - Bruk punktum som desimalskilletegn (1,5 → 1.5)
   - Fjern tusenskilletegn (1 234 → 1234)
   - Tomme celler = blank (ikke "N/A" eller "-")

5. Kolonnerekkeefølge:
   - Kategori- eller datokolonne FØRST
   - Tallkolonner deretter
   - Fjern kolonner som ikke er nødvendige for visualisering

6. Hvis data er i "bredt" format (én kolonne per kategori):
   - Behold det brede formatet
   - Kategorinavn = kolonnehoder

7. Hvis data er i "langt" format (én rad per kategori + verdi):
   - Behold det lange formatet
   - Kolonnene skal være: [x-akse, kategori-kolonne, verdi-kolonne]

SVAR-FORMAT:
Først: en kort analyse (3-5 linjer) av hva du fant og hva du endret.
Deretter: lever den rensede filen som en nedlastbar CSV.

VIKTIG: Ikke finn opp tall. Ikke endre verdier. Kun rens struktur og format.`;

const FORMAT_RULES = [
  { icon: '✅', label: 'Første rad er kolonnenavn', bad: 'Tittel i A1, kolonner i A4', good: 'bank, nim, år' },
  { icon: '✅', label: 'Én rad = én observasjon', bad: 'Aggregater og rådata blandet', good: 'DNB, 1.82, 2024' },
  { icon: '✅', label: 'Rene tall uten enheter', bad: '"1 234 mill. kr"', good: '"1234"' },
  { icon: '✅', label: 'Punktum som desimal', bad: '"1,82"', good: '"1.82"' },
  { icon: '✅', label: 'ISO-datoformat', bad: '"01.01.2024"', good: '"2024-01-01"' },
  { icon: '✅', label: 'Ingen tomme rader', bad: 'Skillerader mellom seksjoner', good: 'Sammenhengende data' },
  { icon: '✅', label: 'Ingen fotnoter', bad: '"Kilde: SSB" i rad 20', good: 'Slett, legg kilde i chat' },
];

function CopyButton({ text, label = 'Kopier prompt' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }
  return (
    <button onClick={copy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${copied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-accent text-white hover:bg-accent-dark'}`}>
      {copied
        ? <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Kopiert!</>
        : <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{label}</>
      }
    </button>
  );
}

export default function InstructionsPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'prompt' | 'regler'>('prompt');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <span className="text-sm font-bold text-gray-800">Instruksjoner</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Rens data</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-50 p-1.5 mx-4 mt-3 rounded-lg">
            <button onClick={() => setTab('prompt')}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${tab === 'prompt' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Rens-prompt
            </button>
            <button onClick={() => setTab('regler')}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${tab === 'regler' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Dataformat-regler
            </button>
          </div>

          <div className="p-4 space-y-3">
            {tab === 'prompt' && (
              <>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 leading-relaxed">
                  <strong>Slik bruker du det:</strong> Kopier prompten under → åpne{' '}
                  <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="underline font-semibold">claude.ai</a>{' '}
                  → lim inn prompten + last opp Excel-filen → last ned den rensede CSV-en → bruk den her.
                </div>

                {/* Prompt preview */}
                <div className="bg-gray-900 rounded-xl p-3 max-h-48 overflow-y-auto">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap leading-relaxed">
                    {CLEAN_PROMPT}
                  </pre>
                </div>

                <div className="flex items-center justify-between">
                  <CopyButton text={CLEAN_PROMPT} />
                  <a href="https://claude.ai" target="_blank" rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline font-medium flex items-center gap-1">
                    Åpne Claude.ai
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                </div>
              </>
            )}

            {tab === 'regler' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-3">Botten forventer data i dette formatet:</p>
                {FORMAT_RULES.map((rule, i) => (
                  <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{rule.icon}</span>
                      <span className="text-xs font-semibold text-gray-700">{rule.label}</span>
                    </div>
                    <div className="ml-6 flex gap-3 text-[11px]">
                      <div className="flex-1 bg-red-50 rounded-lg px-2 py-1.5">
                        <p className="text-red-400 font-semibold mb-0.5">Galt</p>
                        <p className="text-red-700 font-mono">{rule.bad}</p>
                      </div>
                      <div className="flex-1 bg-green-50 rounded-lg px-2 py-1.5">
                        <p className="text-green-500 font-semibold mb-0.5">Riktig</p>
                        <p className="text-green-700 font-mono">{rule.good}</p>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 mt-3">
                  <strong>Tips for SSB-filer:</strong> SSB eksporterer alltid med tittelrader, fotnoter og komma som desimalskilletegn. Bruk rens-prompten over for å fikse dette automatisk.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

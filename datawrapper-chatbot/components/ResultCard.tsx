'use client';

import { useState } from 'react';
import { ChartPlan } from '@/lib/chartPlanner';

export interface ChartResult {
  chartId: string;
  url: string;
  embedCode: string;
  reasoning: string;
  plan?: ChartPlan;
}

interface ResultCardProps {
  result: ChartResult;
}

const CHART_TYPE_LABELS: Record<string, string> = {
  'd3-bars':             'Stolpediagram',
  'd3-bars-stacked':     'Stablet stolpediagram',
  'd3-lines':            'Linjediagram',
  'd3-area':             'Arealdiagram',
  'd3-scatter-plot':     'Spredningsdiagram',
  'tables':              'Datatabell',
  'd3-maps-choropleth':  'Koroplettkart',
  'd3-maps-symbols':     'Symbolkart',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
        transition-all duration-150
        ${copied
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
        }
      `}
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Kopiert!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Kopier
        </>
      )}
    </button>
  );
}

export default function ResultCard({ result }: ResultCardProps) {
  const { chartId, url, embedCode, reasoning, plan } = result;
  const chartTypeLabel = plan?.datawrapperType ? CHART_TYPE_LABELS[plan.datawrapperType] ?? plan.datawrapperType : '';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-accent to-accent-dark px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">
              {plan?.title ?? 'Graf opprettet'}
            </p>
            {chartTypeLabel && (
              <p className="text-white/70 text-xs">{chartTypeLabel}</p>
            )}
          </div>
          <div className="ml-auto">
            <span className="flex items-center gap-1.5 bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Publisert
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* AI reasoning */}
        {reasoning && (
          <div className="flex gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-3.5">
            <span className="text-base shrink-0">🤖</span>
            <p className="text-sm text-amber-800 leading-relaxed">{reasoning}</p>
          </div>
        )}

        {/* Chart ID */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Chart ID</p>
            <CopyButton text={chartId} />
          </div>
          <code className="block bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700">
            {chartId}
          </code>
        </div>

        {/* Datawrapper link */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
            Datawrapper-lenke
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-accent/5 border border-accent/20 rounded-lg px-3 py-2.5 hover:bg-accent/10 transition-colors group"
          >
            <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="text-sm text-accent font-medium group-hover:underline truncate">
              Åpne i Datawrapper
            </span>
          </a>
        </div>

        {/* Embed code */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Embed-kode</p>
            <CopyButton text={embedCode} />
          </div>
          <div className="relative">
            <textarea
              className="embed-textarea"
              rows={5}
              readOnly
              value={embedCode}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">Klikk i feltet for å markere alt · lim inn i artikkel-CMS</p>
        </div>

        {/* Plan details */}
        {plan && (
          <details className="group">
            <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 select-none flex items-center gap-1">
              <svg className="w-3.5 h-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              Chart-plan (debug)
            </summary>
            <pre className="mt-2 bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-auto max-h-48 font-mono">
              {JSON.stringify(plan, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

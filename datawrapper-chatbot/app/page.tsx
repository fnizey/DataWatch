'use client';

import { useState } from 'react';
import FileUpload, { UploadResult } from '@/components/FileUpload';
import DataPreview from '@/components/DataPreview';
import ChatPanel, { Message } from '@/components/ChatPanel';
import ResultCard, { ChartResult } from '@/components/ResultCard';
import ChartOptions, { ChartOverrides } from '@/components/ChartOptions';

const PIPELINE_STEPS = [
  'Analyserer datasett…',
  'Lager chart-plan med AI…',
  'Oppretter Datawrapper-graf…',
  'Laster opp data…',
  'Publiserer…',
];

interface StepState {
  step: string;
  done: boolean;
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Home() {
  const [uploadData, setUploadData] = useState<UploadResult | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState<StepState[]>([]);
  const [chartResult, setChartResult] = useState<ChartResult | null>(null);
  const [overrides, setOverrides] = useState<ChartOverrides>({});

  function addMessage(role: Message['role'], content: string) {
    setMessages((prev) => [
      ...prev,
      { id: newId(), role, content, timestamp: new Date() },
    ]);
  }

  function updateStep(index: number) {
    setLoadingSteps(
      PIPELINE_STEPS.map((step, i) => ({ step, done: i < index }))
    );
  }

  async function handleSend(userPrompt: string) {
    if (!uploadData) return;

    addMessage('user', userPrompt);
    setIsProcessing(true);
    setChartResult(null);

    try {
      // ── Step 1: Plan chart with AI ──────────────────────────────────────
      updateStep(1);

      const planRes = await fetch('/api/plan-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt,
          columns: uploadData.columns,
          preview: uploadData.preview,
          totalRows: uploadData.totalRows,
        }),
      });

      const planData = await planRes.json();
      if (!planRes.ok) throw new Error(planData.error ?? 'Chart-planlegging feilet');

      const { plan } = planData;

      // Build a readable summary of what AI picked up
      const axisNote = plan.yAxisMin !== null && plan.yAxisMax !== null
        ? ` · Y-akse: ${plan.yAxisMin}–${plan.yAxisMax}` : '';
      const formatNote = plan.valueFormat
        ? ` · Format: ${plan.valueFormat}` : '';
      const overrideNote = Object.keys(overrides).length > 0
        ? ` · Manuell overstyring: ${Object.keys(overrides).join(', ')}` : '';

      addMessage(
        'assistant',
        `Lager "${overrides.title || plan.title}" (${plan.datawrapperType})${axisNote}${formatNote}${overrideNote}. ${plan.reasoning}`
      );

      // ── Step 2–4: Create, upload and publish ────────────────────────────
      updateStep(2);

      const createRes = await fetch('/api/create-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          rows: uploadData.rows,
          overrides,
        }),
      });

      updateStep(3);
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error ?? 'Oppretting av chart feilet');

      updateStep(4);
      await new Promise((r) => setTimeout(r, 600));
      updateStep(5);

      const result: ChartResult = {
        chartId: createData.chartId,
        url: createData.url,
        embedCode: createData.embedCode,
        reasoning: createData.reasoning ?? '',
        plan,
      };

      setChartResult(result);
      addMessage(
        'assistant',
        `✅ Publisert! Chart ID: ${createData.chartId}`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Noe gikk galt';
      addMessage('system', `⚠️ Feil: ${message}`);
    } finally {
      setIsProcessing(false);
      setLoadingSteps([]);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-newsroom-bg">
      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <header className="bg-newsroom-dark border-b border-gray-800 px-6 h-14 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <span className="text-white font-bold text-sm tracking-tight">AI Datawrapper</span>
          <span className="hidden sm:inline text-gray-600 text-sm">·</span>
          <span className="hidden sm:inline text-gray-400 text-xs">Journalistverktøy</span>
        </div>
        <div className="ml-auto">
          <span className="text-xs bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded-full font-medium">
            Beta
          </span>
        </div>
      </header>

      {/* ── Main layout ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">

        {/* ── Left panel ───────────────────────────────────────────── */}
        <div className="w-full lg:w-[400px] lg:shrink-0 flex flex-col gap-4">

          {/* Upload */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-gray-800">Last opp datasett</h2>
            </div>
            <FileUpload
              onUpload={(result) => {
                setUploadData(result);
                setChartResult(null);
                setMessages([]);
              }}
              isLoading={isProcessing}
            />
          </div>

          {/* Data preview */}
          {uploadData && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center">
                  <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-gray-800">Datasett</h2>
              </div>
              <DataPreview data={uploadData} />
            </div>
          )}

          {/* Manual overrides — show when data is loaded */}
          {uploadData && (
            <ChartOptions onChange={setOverrides} />
          )}

          {/* Tips when no data */}
          {!uploadData && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Slik bruker du verktøyet</p>
              <ol className="space-y-2.5">
                {[
                  'Last opp CSV, XLS eller XLSX',
                  'Huk av for manuell tittel/ingress/kilde (valgfritt)',
                  'Skriv hva du vil lage i chatten',
                  'Spesifiser y-akse og desimaler i prompten',
                  'AI lager graf i Datawrapper automatisk',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 bg-accent/10 text-accent text-xs font-bold rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-xs text-gray-600">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* ── Right panel: Chat + Result ────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-[400px] lg:min-h-0">
            <ChatPanel
              messages={messages}
              onSend={handleSend}
              isProcessing={isProcessing}
              loadingSteps={loadingSteps}
              disabled={!uploadData}
            />
          </div>
          {chartResult && (
            <div className="shrink-0">
              <ResultCard result={chartResult} />
            </div>
          )}
        </div>
      </main>

      <footer className="h-10 border-t border-gray-200 bg-white flex items-center justify-center">
        <p className="text-xs text-gray-400">
          AI Datawrapper Beta · OpenAI GPT-4o + Datawrapper API v3
        </p>
      </footer>
    </div>
  );
}

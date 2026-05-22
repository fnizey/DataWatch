'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface LoadingStep {
  step: string;
  done: boolean;
}

interface ChatPanelProps {
  messages: Message[];
  onSend: (message: string) => void;
  isProcessing: boolean;
  loadingSteps: LoadingStep[];
  disabled: boolean;
}

const PLACEHOLDER_HINTS = [
  'Lag et stolpediagram over inntekter per bank',
  'Lag et linjediagram over utvikling over tid',
  'Sorter etter høyeste verdi, norsk tittel',
  'Lag et kart over verdier per fylke',
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="loading-dot w-2 h-2 bg-gray-400 rounded-full inline-block" />
      <span className="loading-dot w-2 h-2 bg-gray-400 rounded-full inline-block" />
      <span className="loading-dot w-2 h-2 bg-gray-400 rounded-full inline-block" />
    </div>
  );
}

export default function ChatPanel({
  messages,
  onSend,
  isProcessing,
  loadingSteps,
  disabled,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Rotate placeholder hints
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_HINTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  // Auto-resize textarea
  function handleInput() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isProcessing || disabled) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const activeSteps = loadingSteps.filter((s) => !s.done);
  const currentStep = activeSteps[0]?.step ?? '';

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-800">AI-assistent</h2>
          <p className="text-xs text-gray-400">Beskriv hva du vil visualisere</p>
        </div>
        {isProcessing && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-accent font-medium">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            Jobber…
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 bg-gray-50 border border-gray-200 rounded-2xl mx-auto flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Klar til å lage grafer</p>
              <p className="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">
                {disabled
                  ? 'Last opp en datafil til venstre for å komme i gang'
                  : 'Beskriv hvilken visualisering du ønsker'}
              </p>
            </div>
            {!disabled && (
              <div className="space-y-2 text-left bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
                <p className="font-medium text-gray-600">Eksempler:</p>
                {PLACEHOLDER_HINTS.map((hint, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(hint)}
                    className="block w-full text-left hover:text-accent hover:bg-white rounded px-2 py-1 transition-colors"
                  >
                    „{hint}"
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-enter flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && (
              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs mr-2 shrink-0 mt-0.5">
                🤖
              </div>
            )}
            <div
              className={`
                max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-accent text-white rounded-tr-sm'
                  : msg.role === 'system'
                  ? 'bg-red-50 text-red-700 border border-red-200 text-xs'
                  : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-sm'
                }
              `}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading state */}
        {isProcessing && (
          <div className="flex justify-start message-enter">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs mr-2 shrink-0 mt-0.5">
              🤖
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 space-y-2">
              {/* Progress steps */}
              <div className="space-y-1.5">
                {loadingSteps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {s.done ? (
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i === loadingSteps.filter((x) => !x.done).findIndex(() => true) + loadingSteps.filter((x) => x.done).length ? (
                      <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 border border-gray-300 rounded-full shrink-0" />
                    )}
                    <span className={s.done ? 'text-gray-400 line-through' : i === loadingSteps.filter((x) => !x.done).findIndex(() => true) + loadingSteps.filter((x) => x.done).length ? 'text-accent font-medium' : 'text-gray-400'}>
                      {s.step}
                    </span>
                  </div>
                ))}
              </div>
              {currentStep && <TypingIndicator />}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className={`
          flex items-end gap-2 bg-gray-50 rounded-xl border transition-colors
          ${disabled ? 'opacity-50 border-gray-200' : 'border-gray-200 focus-within:border-accent focus-within:bg-white'}
        `}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Last opp en fil for å starte…' : PLACEHOLDER_HINTS[placeholderIdx]}
            disabled={disabled || isProcessing}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none px-3 py-3 text-sm text-gray-800 placeholder:text-gray-400 disabled:cursor-not-allowed min-h-[44px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing || disabled}
            className={`
              m-1.5 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150
              ${!input.trim() || isProcessing || disabled
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-accent text-white hover:bg-accent-dark active:scale-95'
              }
            `}
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14m-7-7l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center">
          Enter for å sende · Shift+Enter for ny linje
        </p>
      </div>
    </div>
  );
}

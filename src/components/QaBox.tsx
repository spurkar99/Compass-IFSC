'use client';

import { useState } from 'react';

interface QaResponse {
  ok: boolean;
  error?: string;
  answer?: string;
  source?: 'bedrock' | 'fallback';
  model?: string;
  citations?: Array<{ ruleId: string; citationRef: string; citationText: string; title: string }>;
}

const SUGGESTIONS = [
  'What experience does a Principal Officer need?',
  'How often must staff complete AML training?',
  'What qualifications are accepted for a Principal Officer?',
  'Does the compliance officer rule apply to a small fund?',
];

export function QaBox() {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QaResponse | null>(null);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
      });
      setResult((await response.json()) as QaResponse);
    } catch (caught) {
      setResult({ ok: false, error: caught instanceof Error ? caught.message : 'Request failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Ask about the rules</h2>
        </div>
      </div>
      <div className="card-body">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <label className="field-label" htmlFor="question">Your question</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="question"
              className="field"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="e.g. How much experience does a Principal Officer need?"
            />
            <button type="submit" className="btn-accent shrink-0" disabled={busy}>
              {busy ? 'Looking…' : 'Ask'}
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-body hover:bg-canvas"
              onClick={() => {
                setQuestion(suggestion);
                void ask(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <p className="field-hint mt-4">
          The only place a language model is used. It cannot decide whether anyone meets a
          requirement — that is always the engine.
        </p>

        {result ? (
          <div className="mt-5 space-y-4">
            {result.ok ? (
              <>
                <div className="rounded border border-line bg-canvas px-4 py-3">
                  <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-body">
                    {result.answer}
                  </p>
                  <p className="mt-3 text-[11px] text-ink-muted">
                    {result.source === 'bedrock'
                      ? `Written by ${result.model ?? 'Claude on AWS Bedrock'} from the extracts below.`
                      : 'AWS Bedrock is not configured, so no AI was called — the relevant rule text is quoted directly below.'}
                  </p>
                </div>

                {result.citations && result.citations.length > 0 ? (
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      Sources used
                    </h3>
                    <ul className="mt-2 space-y-3">
                      {result.citations.map((citation) => (
                        <li key={citation.ruleId}>
                          <p className="text-[13px] font-medium text-ink">
                            {citation.ruleId} — {citation.title}
                          </p>
                          <p className="text-[12px] text-ink-muted">{citation.citationRef}</p>
                          <blockquote className="citation mt-1.5">
                            &ldquo;{citation.citationText}&rdquo;
                          </blockquote>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="rounded border border-flag/30 bg-flag-bg px-4 py-3 text-[13px] text-flag">
                {result.error}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

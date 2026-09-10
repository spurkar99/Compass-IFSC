'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { StatusTally } from '@/types';

interface UploadResult {
  ok: boolean;
  error?: string;
  mode?: string;
  imported?: number;
  rowsRead?: number;
  replaced?: number;
  updated?: number;
  added?: number;
  rosterSize?: number;
  warnings?: string[];
  missingDataNotes?: string[];
  tally?: StatusTally;
}

export function CsvUploadCard({
  entityId,
  entityName,
}: {
  entityId: string;
  entityName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.set('entityId', entityId);
      form.set('mode', mode);
      form.set('file', file);
      const response = await fetch('/api/employees/upload', { method: 'POST', body: form });
      const payload = (await response.json()) as UploadResult;
      setResult(payload);
      if (payload.ok) router.refresh();
    } catch (caught) {
      setResult({ ok: false, error: caught instanceof Error ? caught.message : 'Upload failed.' });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Upload a roster (CSV)</h2>
        <a
          href="/api/employees/template"
          className="text-[13px] font-medium text-accent hover:underline"
        >
          Template
        </a>
      </div>
      <div className="card-body space-y-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: 'merge', label: 'Add / update people' },
              { value: 'replace', label: 'Replace whole roster' },
            ] as const
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              className={`rounded border px-3 py-1.5 text-[12px] transition-colors ${
                mode === item.value
                  ? 'border-accent bg-accent-soft font-medium text-accent'
                  : 'border-line bg-surface text-ink-body hover:bg-canvas'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          aria-label={`Upload a CSV roster for ${entityName}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          className="field file:mr-3 file:rounded file:border-0 file:bg-brand file:px-3 file:py-1.5
                     file:text-[12px] file:font-medium file:text-white hover:file:bg-brand-soft"
        />

        <p className="field-hint">
          {mode === 'merge'
            ? 'Rows are matched on employee id: existing people are updated, new ones added.'
            : 'Everyone currently on this roster is removed and replaced by the file.'}{' '}
          Blank cells become <span className="font-medium text-review">needs review</span>, never a
          failure.
        </p>

        {busy ? <p className="text-[13px] text-ink-body">Reading the file…</p> : null}

        {result ? (
          <div
            className={`rounded border px-4 py-3 text-[13px] ${
              result.ok ? 'border-pass/30 bg-pass-bg' : 'border-flag/30 bg-flag-bg'
            }`}
          >
            {result.ok ? (
              <>
                <p className="font-medium text-ink">
                  {result.mode === 'merge'
                    ? `${result.added} added, ${result.updated} updated — roster now ${result.rosterSize}.`
                    : `Roster replaced with ${result.imported} of ${result.rowsRead} rows.`}
                </p>
                {result.tally ? (
                  <p className="mt-0.5 text-ink-body">
                    {result.tally.pass} met · {result.tally.flagged} flagged ·{' '}
                    {result.tally.needsReview} needing review
                  </p>
                ) : null}
              </>
            ) : (
              <p className="font-medium text-flag">{result.error}</p>
            )}

            {result.warnings && result.warnings.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-ink-body">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            {result.missingDataNotes && result.missingDataNotes.length > 0 ? (
              <details className="mt-2 text-[12px]">
                <summary className="cursor-pointer text-ink-muted">
                  {result.missingDataNotes.length} record
                  {result.missingDataNotes.length === 1 ? '' : 's'} with blank fields
                </summary>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-body">
                  {result.missingDataNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

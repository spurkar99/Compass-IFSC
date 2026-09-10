'use client';

import { useEffect, useState } from 'react';
import type { AuditResult, DraftResult, DraftRule } from '@/types';

interface SchemaIssue {
  field: string;
  severity: 'BLOCKER' | 'WARNING';
  issue: string;
  repairedTo?: string;
}

interface SampleDoc {
  name: string;
  label: string;
  text: string;
}

type Stage = 'idle' | 'drafting' | 'auditing' | 'done';

const SEVERITY_STYLE: Record<string, { chip: string; border: string }> = {
  BLOCKER: { chip: 'bg-flag text-white', border: 'border-flag/30 bg-flag-bg' },
  WARNING: { chip: 'bg-review text-white', border: 'border-review/30 bg-review-bg' },
  OK: { chip: 'bg-pass text-white', border: 'border-pass/25 bg-pass-bg' },
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 text-[13px] ${value ? 'text-ink-body' : 'italic text-ink-muted'}`}>
        {value || 'not stated'}
      </dd>
    </div>
  );
}

function draftFields(draft: DraftRule): Array<[string, string]> {
  return [
    ['Targets', draft.allEmployees ? 'All employees' : draft.targetRoles.join(', ')],
    ['Requirement', draft.requirementType],
    ['Value', draft.requirementValue],
    ['Certification', draft.certificationName],
    ['Entity type', draft.entityType],
    ['Category', draft.category],
    ['Min AUM (USD m)', draft.minAum],
    ['Effective from', draft.effectiveDate],
  ];
}

/**
 * The two-agent intake pipeline, with its working shown.
 *
 * Nothing here files anything. The panel ends at a hand-off: the human sends the
 * proposal to the guideline form, reads it, and submits it themselves.
 */
export function IntakePanel({ onProposal }: { onProposal: (draft: DraftRule) => void }) {
  const [samples, setSamples] = useState<SampleDoc[]>([]);
  const [sourceText, setSourceText] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [drafting, setDrafting] = useState<DraftResult | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [proposed, setProposed] = useState<DraftRule | null>(null);
  const [schemaIssues, setSchemaIssues] = useState<SchemaIssue[]>([]);
  const [usedCorrected, setUsedCorrected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handedOff, setHandedOff] = useState(false);

  useEffect(() => {
    fetch('/api/sample-circulars')
      .then((response) => response.json())
      .then((payload) => setSamples(payload.documents ?? []))
      .catch(() => setSamples([]));
  }, []);

  // A visible clock, because the two agents together take half a minute and a
  // frozen button looks like a broken one.
  useEffect(() => {
    if (stage !== 'drafting' && stage !== 'auditing') return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [stage]);

  function reset() {
    setDrafting(null);
    setAudit(null);
    setProposed(null);
    setSchemaIssues([]);
    setUsedCorrected(false);
    setError(null);
    setHandedOff(false);
  }

  async function run() {
    reset();
    setStage('drafting');
    setElapsed(0);
    try {
      const draftResponse = await fetch('/api/intake/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText }),
      });
      const draftPayload = await draftResponse.json();
      if (!draftPayload.ok) {
        setError(draftPayload.error ?? 'The Drafting Agent failed.');
        setStage('idle');
        return;
      }
      setDrafting(draftPayload.drafting);

      setStage('auditing');
      setElapsed(0);
      const auditResponse = await fetch('/api/intake/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceText, draft: draftPayload.drafting.draft }),
      });
      const auditPayload = await auditResponse.json();
      setProposed(auditPayload.proposed ?? draftPayload.drafting.draft);
      setSchemaIssues(auditPayload.schemaIssues ?? []);
      if (auditPayload.ok) {
        setAudit(auditPayload.audit);
        setUsedCorrected(Boolean(auditPayload.usedCorrectedDraft));
      } else {
        setError(auditPayload.error ?? 'The Audit Agent failed.');
      }
      setStage('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The intake pipeline failed.');
      setStage('idle');
    }
  }

  const busy = stage === 'drafting' || stage === 'auditing';
  const blockers = [
    ...(audit?.findings ?? []).filter((finding) => finding.severity === 'BLOCKER'),
    ...schemaIssues.filter((issue) => issue.severity === 'BLOCKER'),
  ].length;

  return (
    <section className="card" id="intake">
      <div className="card-head">
        <div>
          <h2 className="card-title">Read a circular (2 agents)</h2>
          <p className="card-sub">
            A drafting agent structures it, an audit agent attacks the draft, then code checks
            both. You sign off.
          </p>
        </div>
      </div>

      <div className="card-body space-y-4">
        {samples.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-ink-muted">Samples:</span>
            {samples.map((sample) => (
              <button
                key={sample.name}
                type="button"
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] text-ink-body hover:bg-canvas"
                onClick={() => {
                  setSourceText(sample.text);
                  reset();
                  setStage('idle');
                }}
              >
                {sample.label}
              </button>
            ))}
          </div>
        ) : null}

        <div>
          <label className="field-label" htmlFor="source">
            Text of the circular
          </label>
          <textarea
            id="source"
            className="field min-h-[150px] font-mono text-[12px] leading-relaxed"
            value={sourceText}
            onChange={(event) => setSourceText(event.target.value)}
            placeholder="Paste the published circular, or pick a sample above."
          />
          <p className="field-hint">
            {sourceText.trim().length} characters. Nothing is saved by this step — it produces a
            proposal for you to approve.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-accent" onClick={run} disabled={busy || !sourceText.trim()}>
            {busy ? 'Working…' : 'Run the intake agents'}
          </button>
          {busy ? (
            <span className="text-[13px] text-ink-body">
              {stage === 'drafting' ? 'Agent 1 is reading the document' : 'Agent 2 is auditing the draft'}
              {' · '}
              {elapsed}s
            </span>
          ) : null}
          {!busy && stage === 'done' ? (
            <span className="text-[12px] text-ink-muted">
              Both agents finished. {blockers > 0 ? `${blockers} blocker(s) raised.` : 'No blockers.'}
            </span>
          ) : null}
        </div>

        {/* progress rail */}
        {stage !== 'idle' ? (
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            {[
              { key: 'a1', label: 'Agent 1 · draft', done: Boolean(drafting), active: stage === 'drafting' },
              { key: 'a2', label: 'Agent 2 · audit', done: Boolean(audit), active: stage === 'auditing' },
              { key: 'v', label: 'Code · validate', done: stage === 'done', active: false },
              { key: 'h', label: 'You · sign off', done: handedOff, active: stage === 'done' && !handedOff },
            ].map((step) => (
              <li
                key={step.key}
                className={`rounded border px-3 py-2 text-[12px] ${
                  step.done
                    ? 'border-pass/30 bg-pass-bg font-medium text-pass'
                    : step.active
                      ? 'border-accent bg-accent-soft font-medium text-accent'
                      : 'border-line bg-canvas text-ink-muted'
                }`}
              >
                {step.done ? '✓ ' : step.active ? '● ' : '○ '}
                {step.label}
              </li>
            ))}
          </ol>
        ) : null}

        {error ? (
          <p className="rounded border border-flag/30 bg-flag-bg px-4 py-3 text-[13px] text-flag">
            {error}
          </p>
        ) : null}

        {/* ---------------- Agent 1 ---------------- */}
        {drafting ? (
          <div className="rounded border border-line">
            <div className="flex items-center justify-between border-b border-line bg-canvas px-4 py-2.5">
              <h3 className="text-[13px] font-semibold text-ink">Agent 1 — Drafting</h3>
              <span className="text-[11px] text-ink-muted">
                {drafting.evidence.length} source quote{drafting.evidence.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="space-y-3 px-4 py-3">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {draftFields(drafting.draft).map(([label, value]) => (
                  <Field key={label} label={label} value={value} />
                ))}
              </dl>

              {drafting.evidence.length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-[12px] font-medium text-accent">
                    Why it said that — quotes from the document
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {drafting.evidence.map((item, index) => (
                      <li key={`${item.field}-${index}`} className="text-[12px]">
                        <span className="font-semibold text-ink">{item.field}</span>
                        <blockquote className="citation mt-1">
                          {item.quote ? `“${item.quote}”` : 'not stated in the document'}
                        </blockquote>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              {drafting.notes.length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-[12px] font-medium text-accent">
                    {drafting.notes.length} note{drafting.notes.length === 1 ? '' : 's'} — what the
                    document leaves unstated
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[12px] text-ink-body">
                    {drafting.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ---------------- Agent 2 ---------------- */}
        {audit ? (
          <div className="rounded border border-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5">
              <h3 className="text-[13px] font-semibold text-ink">Agent 2 — Audit</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                  audit.verdict === 'APPROVE'
                    ? 'bg-pass text-white'
                    : audit.verdict === 'REJECT'
                      ? 'bg-flag text-white'
                      : 'bg-review text-white'
                }`}
              >
                {audit.verdict === 'APPROVE'
                  ? 'agrees with Agent 1'
                  : audit.verdict === 'REJECT'
                    ? 'rejected'
                    : 'corrections made'}
              </span>
            </div>
            <div className="space-y-3 px-4 py-3">
              <p className="text-[13px] leading-relaxed text-ink-body">{audit.summary}</p>

              {audit.findings.filter((f) => f.severity !== 'OK').length > 0 ? (
                <ul className="space-y-2">
                  {audit.findings
                    .filter((finding) => finding.severity !== 'OK')
                    .map((finding, index) => (
                      <li
                        key={index}
                        className={`rounded border px-3 py-2.5 ${SEVERITY_STYLE[finding.severity].border}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLE[finding.severity].chip}`}
                          >
                            {finding.severity}
                          </span>
                          <span className="text-[12px] font-semibold text-ink">{finding.field}</span>
                        </div>
                        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-body">
                          {finding.issue}
                        </p>
                        {finding.quote ? (
                          <blockquote className="citation mt-2">“{finding.quote}”</blockquote>
                        ) : null}
                        {finding.suggested ? (
                          <p className="mt-1.5 text-[12px] text-ink-body">
                            <span className="font-semibold text-ink">Suggested: </span>
                            {finding.suggested}
                          </p>
                        ) : null}
                      </li>
                    ))}
                </ul>
              ) : null}

              {audit.findings.filter((f) => f.severity === 'OK').length > 0 ? (
                <details>
                  <summary className="cursor-pointer text-[12px] font-medium text-accent">
                    {audit.findings.filter((f) => f.severity === 'OK').length} field
                    {audit.findings.filter((f) => f.severity === 'OK').length === 1 ? '' : 's'}{' '}
                    checked and found correct
                  </summary>
                  <ul className="mt-2 space-y-1.5 text-[12px] text-ink-body">
                    {audit.findings
                      .filter((finding) => finding.severity === 'OK')
                      .map((finding, index) => (
                        <li key={index}>
                          <span className="font-semibold text-ink">{finding.field}</span> —{' '}
                          {finding.issue}
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ---------------- Layer 3 ---------------- */}
        {stage === 'done' ? (
          <div className="rounded border border-line">
            <div className="flex items-center justify-between border-b border-line bg-canvas px-4 py-2.5">
              <h3 className="text-[13px] font-semibold text-ink">
                Deterministic validation <span className="font-normal text-ink-muted">(no AI)</span>
              </h3>
              <span className="text-[11px] text-ink-muted">
                {schemaIssues.length === 0
                  ? 'nothing to report'
                  : `${schemaIssues.length} issue${schemaIssues.length === 1 ? '' : 's'}`}
              </span>
            </div>
            <div className="px-4 py-3">
              {schemaIssues.length === 0 ? (
                <p className="text-[12px] text-ink-body">
                  Units, exact-match fields and requirement types all check out against this
                  system&rsquo;s schema and the names actually on the rosters.
                </p>
              ) : (
                <ul className="space-y-2">
                  {schemaIssues.map((issue, index) => (
                    <li
                      key={index}
                      className={`rounded border px-3 py-2.5 ${SEVERITY_STYLE[issue.severity].border}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SEVERITY_STYLE[issue.severity].chip}`}
                        >
                          {issue.severity}
                        </span>
                        <span className="text-[12px] font-semibold text-ink">{issue.field}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-body">
                        {issue.issue}
                      </p>
                      {issue.repairedTo ? (
                        <p className="mt-1.5 text-[12px] text-ink-body">
                          <span className="font-semibold text-ink">Repaired to: </span>
                          <code className="rounded bg-surface px-1">{issue.repairedTo}</code>
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        {/* ---------------- Human sign-off ---------------- */}
        {proposed && stage === 'done' ? (
          <div className="rounded-card border border-accent/40 bg-accent-soft px-4 py-4">
            <h3 className="text-[13px] font-semibold text-ink">
              Your sign-off {usedCorrected ? '— using Agent 2’s corrected version' : ''}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-body">
              {blockers > 0
                ? `${blockers} blocker${blockers === 1 ? ' was' : 's were'} raised above. Read them before you file this — the agents can be wrong, and nothing is filed until you submit the form yourself.`
                : 'Neither agent nor the validator found a blocker. Check it anyway: nothing is filed until you submit the form yourself.'}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {draftFields(proposed).map(([label, value]) => (
                <Field key={label} label={label} value={value} />
              ))}
            </dl>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onProposal(proposed);
                  setHandedOff(true);
                  document.getElementById('guideline-form')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Send to the guideline form for sign-off
              </button>
              {handedOff ? (
                <span className="text-[12px] font-medium text-accent">
                  Loaded into the form below — review it and file it.
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

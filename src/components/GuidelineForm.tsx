'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { DraftRule, RequirementType, Rule } from '@/types';

const REQUIREMENT_OPTIONS: Array<{
  value: RequirementType;
  label: string;
  valueLabel: string;
  valueHint: string;
  numeric: boolean;
  needsCertName?: boolean;
}> = [
  {
    value: 'HAS_CERTIFICATION',
    label: 'Must hold a certification',
    valueLabel: 'Certification that must be held',
    valueHint: 'Exactly as it is written on the roster, e.g. "NISM-Series-XIX-C: Alternative Investment Fund Managers Certification".',
    numeric: false,
  },
  {
    value: 'CERTIFICATION_NOT_EXPIRED',
    label: 'Certification must not have expired',
    valueLabel: 'Certification that must still be valid',
    valueHint: 'The person must hold it AND its expiry date must be in the future.',
    numeric: false,
  },
  {
    value: 'CERTIFICATION_RENEWED_WITHIN_MONTHS',
    label: 'Training/certification renewed within N months',
    valueLabel: 'Number of months',
    valueHint: 'e.g. 12 for an annual refresher.',
    numeric: true,
    needsCertName: true,
  },
  {
    value: 'MIN_EXPERIENCE_YEARS',
    label: 'Minimum years of relevant experience',
    valueLabel: 'Minimum number of years',
    valueHint: 'e.g. 5.',
    numeric: true,
  },
  {
    value: 'HAS_QUALIFICATION',
    label: 'Must hold an accepted qualification',
    valueLabel: 'Accepted qualifications',
    valueHint: 'Separate alternatives with a semicolon — holding any ONE of them passes. e.g. "MBA (Finance); CFA Charter; Chartered Accountant".',
    numeric: false,
  },
];

interface SubmitResult {
  ok: boolean;
  error?: string;
  mode?: string;
  rule?: Rule;
  notifications?: Array<{
    id: string;
    entityName: string;
    officer: { name: string; email: string };
    newlyFlagged: number;
    newlyNeedsReview: number;
    noLongerFlagged: number;
    names: string[];
  }>;
}

export function GuidelineForm({
  entityTypes,
  knownRoles,
  activeRules,
  demoGuideline,
  prefill,
}: {
  entityTypes: string[];
  knownRoles: string[];
  activeRules: Array<Pick<Rule, 'id' | 'title' | 'version'>>;
  demoGuideline: Partial<Rule> | null;
  /** A proposal handed over from the intake agents, awaiting human sign-off. */
  prefill?: { draft: DraftRule; token: number } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'ADD' | 'UPDATE'>('ADD');
  const [ruleId, setRuleId] = useState(activeRules[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [citationRef, setCitationRef] = useState('');
  const [citationText, setCitationText] = useState('');
  const [citationSource, setCitationSource] = useState('');
  const [entityType, setEntityType] = useState('');
  const [category, setCategory] = useState('');
  const [minAum, setMinAum] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [allEmployees, setAllEmployees] = useState(false);
  const [extraRole, setExtraRole] = useState('');
  const [requirementType, setRequirementType] = useState<RequirementType>('HAS_CERTIFICATION');
  const [requirementValue, setRequirementValue] = useState('');
  const [certificationName, setCertificationName] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    if (!prefill) return;
    const { draft } = prefill;
    setMode('ADD');
    setTitle(draft.title);
    setCitationRef(draft.citationRef);
    setCitationText(draft.citationText);
    setCitationSource(
      'Structured by the intake Drafting Agent, audited by the Audit Agent, checked by the schema validator, and signed off by a person. The source text above is what the agents were given.',
    );
    setEntityType(draft.entityType);
    setCategory(draft.category);
    setMinAum(draft.minAum);
    setAllEmployees(draft.allEmployees);
    setRoles(draft.targetRoles);
    if (draft.requirementType) setRequirementType(draft.requirementType);
    setRequirementValue(draft.requirementValue);
    setCertificationName(draft.certificationName);
    setEffectiveDate(draft.effectiveDate);
    setResult(null);
  }, [prefill]);

  const option = REQUIREMENT_OPTIONS.find((item) => item.value === requirementType)!;
  const roleChoices = Array.from(new Set([...knownRoles, ...roles])).sort();

  function loadDemo() {
    if (!demoGuideline) return;
    setMode('ADD');
    setTitle(demoGuideline.title ?? '');
    setCitationRef(demoGuideline.citationRef ?? '');
    setCitationText(demoGuideline.citationText ?? '');
    setCitationSource(demoGuideline.citationSource ?? '');
    setEntityType(demoGuideline.appliesToEntityFilter?.entityType ?? '');
    setCategory(demoGuideline.appliesToEntityFilter?.category ?? '');
    setMinAum(
      demoGuideline.appliesToEntityFilter?.minAum !== undefined
        ? String(demoGuideline.appliesToEntityFilter.minAum)
        : '',
    );
    const target = demoGuideline.targetRole;
    if (target === '*') {
      setAllEmployees(true);
      setRoles([]);
    } else {
      setAllEmployees(false);
      setRoles(Array.isArray(target) ? target : target ? [target] : []);
    }
    setRequirementType((demoGuideline.requirement?.type as RequirementType) ?? 'HAS_CERTIFICATION');
    setRequirementValue(
      demoGuideline.requirement?.value !== undefined
        ? Array.isArray(demoGuideline.requirement.value)
          ? demoGuideline.requirement.value.join('; ')
          : String(demoGuideline.requirement.value)
        : '',
    );
    setCertificationName(demoGuideline.requirement?.certificationName ?? '');
    setEffectiveDate(demoGuideline.effectiveDate ?? '');
    setResult(null);
  }

  function toggleRole(role: string) {
    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/guidelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          ruleId,
          title,
          citationRef,
          citationText,
          citationSource,
          entityType,
          category,
          minAum,
          targetRoles: roles,
          allEmployees,
          requirementType,
          requirementValue,
          certificationName,
          effectiveDate,
        }),
      });
      const payload = (await response.json()) as SubmitResult;
      setResult(payload);
      if (payload.ok) router.refresh();
    } catch (caught) {
      setResult({ ok: false, error: caught instanceof Error ? caught.message : 'Submission failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" id="guideline-form">
      <div className="card-head">
        <div>
          <h2 className="card-title">File a guideline</h2>
          <p className="card-sub">
            {prefill
              ? 'Loaded from the intake agents. Nothing is filed until you submit it.'
              : 'Checked against every roster on submit.'}
          </p>
        </div>
        {demoGuideline ? (
          <button type="button" className="btn-secondary" onClick={loadDemo}>
            Load demo circular
          </button>
        ) : null}
      </div>

      <form className="card-body space-y-6" onSubmit={submit}>
        {/* mode */}
        <div className="flex flex-wrap gap-2">
          {(['ADD', 'UPDATE'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded border px-3 py-1.5 text-[13px] transition-colors ${
                mode === value
                  ? 'border-accent bg-accent-soft font-medium text-accent'
                  : 'border-line bg-surface text-ink-body hover:bg-canvas'
              }`}
            >
              {value === 'ADD' ? 'New guideline' : 'Update an existing guideline'}
            </button>
          ))}
        </div>

        {mode === 'UPDATE' ? (
          <div>
            <label className="field-label" htmlFor="ruleId">
              Which guideline is changing?
            </label>
            <select
              id="ruleId"
              className="field"
              value={ruleId}
              onChange={(event) => setRuleId(event.target.value)}
            >
              {activeRules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.id} — {rule.title} (v{rule.version})
                </option>
              ))}
            </select>
            <p className="field-hint">The current version is kept; a new one is created.</p>
          </div>
        ) : null}

        {/* the policy */}
        <fieldset className="space-y-4">
          <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            The policy
          </legend>
          <div>
            <label className="field-label" htmlFor="title">Short title</label>
            <input
              id="title"
              className="field"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Principal Officer and Fund Managers — mandatory AIF Managers certification"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="citationRef">Citation reference</label>
            <input
              id="citationRef"
              className="field"
              value={citationRef}
              onChange={(event) => setCitationRef(event.target.value)}
              placeholder="IFSCA Circular F.No. IFSCA-FMD/2026/07 dated 12 August 2026"
            />
            <p className="field-hint">Required — every finding must be traceable to a source.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="citationText">Text of the requirement</label>
            <textarea
              id="citationText"
              className="field min-h-[110px]"
              value={citationText}
              onChange={(event) => setCitationText(event.target.value)}
              placeholder="Paste the actual wording from the circular or regulation."
            />
          </div>
          <div>
            <label className="field-label" htmlFor="citationSource">
              Provenance note <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="citationSource"
              className="field"
              value={citationSource}
              onChange={(event) => setCitationSource(event.target.value)}
              placeholder="Where this text came from, and whether it has been verified."
            />
          </div>
          <div>
            <label className="field-label" htmlFor="effectiveDate">Effective from</label>
            <input
              id="effectiveDate"
              type="date"
              className="field sm:max-w-[220px]"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
            />
          </div>
        </fieldset>

        {/* who it reaches */}
        <fieldset className="space-y-4 border-t border-line pt-5">
          <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Which entities does it reach?
          </legend>
          <p className="text-[12px] text-ink-muted">
            Blank = every entity. Anything you fill in narrows it; all conditions must match.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="entityType">Entity type</label>
              <select
                id="entityType"
                className="field"
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
              >
                <option value="">Any entity type</option>
                {entityTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="category">Category</label>
              <input
                id="category"
                className="field"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Any category"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="minAum">Minimum AUM (USD m)</label>
              <input
                id="minAum"
                type="number"
                min="0"
                className="field"
                value={minAum}
                onChange={(event) => setMinAum(event.target.value)}
                placeholder="No threshold"
              />
            </div>
          </div>
        </fieldset>

        {/* who it targets */}
        <fieldset className="space-y-3 border-t border-line pt-5">
          <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Which people does it target?
          </legend>
          <label className="flex items-center gap-2 text-[13px] text-ink-body">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
              checked={allEmployees}
              onChange={(event) => setAllEmployees(event.target.checked)}
            />
            Every employee, regardless of role
          </label>
          {!allEmployees ? (
            <>
              <div className="flex flex-wrap gap-2">
                {roleChoices.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                      roles.includes(role)
                        ? 'border-accent bg-accent-soft font-medium text-accent'
                        : 'border-line bg-surface text-ink-body hover:bg-canvas'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1">
                  <label className="field-label" htmlFor="extraRole">Add another role</label>
                  <input
                    id="extraRole"
                    className="field"
                    value={extraRole}
                    onChange={(event) => setExtraRole(event.target.value)}
                    placeholder="e.g. Designated Director"
                  />
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const value = extraRole.trim();
                    if (!value) return;
                    setRoles((current) => (current.includes(value) ? current : [...current, value]));
                    setExtraRole('');
                  }}
                >
                  Add role
                </button>
              </div>
            </>
          ) : null}
        </fieldset>

        {/* what it requires */}
        <fieldset className="space-y-4 border-t border-line pt-5">
          <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            What does it require?
          </legend>
          <div>
            <label className="field-label" htmlFor="requirementType">Requirement</label>
            <select
              id="requirementType"
              className="field"
              value={requirementType}
              onChange={(event) => setRequirementType(event.target.value as RequirementType)}
            >
              {REQUIREMENT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          {option.needsCertName ? (
            <div>
              <label className="field-label" htmlFor="certificationName">
                Which certification or training?
              </label>
              <input
                id="certificationName"
                className="field"
                value={certificationName}
                onChange={(event) => setCertificationName(event.target.value)}
                placeholder="AML/CFT Training Certificate"
              />
            </div>
          ) : null}
          <div>
            <label className="field-label" htmlFor="requirementValue">{option.valueLabel}</label>
            <input
              id="requirementValue"
              type={option.numeric ? 'number' : 'text'}
              min={option.numeric ? '0' : undefined}
              className="field"
              value={requirementValue}
              onChange={(event) => setRequirementValue(event.target.value)}
            />
            <p className="field-hint">{option.valueHint}</p>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button type="submit" className="btn-accent" disabled={busy}>
            {busy ? 'Running the checks…' : 'File guideline and run the checks'}
          </button>
          <span className="text-[12px] text-ink-muted">
            Saves the rule, re-checks every roster, notifies the officers affected.
          </span>
        </div>

        {result ? (
          <div
            className={`rounded border px-4 py-4 text-[13px] ${
              result.ok ? 'border-accent/30 bg-accent-soft' : 'border-flag/30 bg-flag-bg'
            }`}
          >
            {result.ok ? (
              <>
                <p className="font-semibold text-ink">
                  {result.mode === 'UPDATE' ? 'Guideline updated' : 'Guideline filed'} as{' '}
                  {result.rule?.id} (version {result.rule?.version}).
                </p>
                {result.notifications && result.notifications.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {result.notifications.map((item) => (
                      <li key={item.id} className="text-ink-body">
                        <span className="font-medium text-ink">{item.entityName}:</span>{' '}
                        {item.newlyFlagged > 0 ? (
                          <>
                            {item.newlyFlagged} newly flagged for review
                            {item.names.length ? ` — ${item.names.join(', ')}` : ''}.
                          </>
                        ) : (
                          'nobody newly flagged.'
                        )}
                        {item.newlyNeedsReview > 0
                          ? ` ${item.newlyNeedsReview} newly need review because data is missing.`
                          : ''}
                        {item.noLongerFlagged > 0
                          ? ` ${item.noLongerFlagged} no longer flagged.`
                          : ''}{' '}
                        <span className="text-ink-muted">
                          {item.officer.name} has been notified.
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-ink-body">
                    It reaches no registered entity, so nobody was notified.
                  </p>
                )}
                <p className="mt-3 text-[12px] text-ink-muted">
                  Open the dashboard to review it.
                </p>
              </>
            ) : (
              <p className="font-medium text-flag">{result.error}</p>
            )}
          </div>
        ) : null}
      </form>
    </section>
  );
}

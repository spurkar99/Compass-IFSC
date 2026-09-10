'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Result {
  ok: boolean;
  error?: string;
  employee?: { id: string; name: string; role: string };
  missing?: string[];
  tally?: { pass: number; flagged: number; needsReview: number };
}

/** Collapsed by default so the dashboard stays quiet until you need it. */
export function AddEmployeeForm({
  entityId,
  entityName,
  knownRoles,
}: {
  entityId: string;
  entityName: string;
  knownRoles: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [certifications, setCertifications] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function reset() {
    setName('');
    setRole('');
    setQualifications('');
    setExperienceYears('');
    setCertifications('');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId,
          name,
          role,
          qualifications,
          experienceYears,
          certifications,
        }),
      });
      const payload = (await response.json()) as Result;
      setResult(payload);
      if (payload.ok) {
        reset();
        router.refresh();
      }
    } catch (caught) {
      setResult({ ok: false, error: caught instanceof Error ? caught.message : 'Failed.' });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        + Add an employee
      </button>
    );
  }

  return (
    <div className="w-full rounded border border-line bg-canvas p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">Add an employee to {entityName}</h3>
        <button
          type="button"
          className="text-[12px] text-ink-muted hover:text-ink"
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
        >
          Close
        </button>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="field-label" htmlFor="emp-name">Name</label>
            <input
              id="emp-name"
              className="field"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="emp-role">Role</label>
            <input
              id="emp-role"
              className="field"
              list="known-roles"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="e.g. Fund Manager"
            />
            <datalist id="known-roles">
              {knownRoles.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="field-label" htmlFor="emp-exp">Years of experience</label>
            <input
              id="emp-exp"
              className="field"
              type="number"
              min="0"
              step="0.5"
              value={experienceYears}
              onChange={(event) => setExperienceYears(event.target.value)}
              placeholder="leave blank if unknown"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="emp-quals">Qualifications</label>
            <input
              id="emp-quals"
              className="field"
              value={qualifications}
              onChange={(event) => setQualifications(event.target.value)}
              placeholder="MBA (Finance); CFA Charter"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="emp-certs">Certifications</label>
            <input
              id="emp-certs"
              className="field"
              value={certifications}
              onChange={(event) => setCertifications(event.target.value)}
              placeholder="AML/CFT Training Certificate|2026-06-01|"
            />
            <p className="field-hint">Name|issued|expiry, separated by semicolons.</p>
          </div>
        </div>

        <p className="field-hint">
          Leave anything you don&rsquo;t have blank — it becomes{' '}
          <span className="font-medium text-review">needs review</span>, never a failure.
        </p>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-accent" disabled={busy}>
            {busy ? 'Adding…' : 'Add and run the checks'}
          </button>
        </div>

        {result ? (
          <div
            className={`rounded border px-3 py-2.5 text-[13px] ${
              result.ok ? 'border-pass/30 bg-pass-bg' : 'border-flag/30 bg-flag-bg'
            }`}
          >
            {result.ok && result.employee && result.tally ? (
              <>
                <p className="font-medium text-ink">
                  {result.employee.name} added as {result.employee.id}.
                </p>
                <p className="mt-0.5 text-ink-body">
                  {result.tally.pass} met · {result.tally.flagged} flagged for review ·{' '}
                  {result.tally.needsReview} needing review
                  {result.missing && result.missing.length > 0
                    ? ` (no ${result.missing.join(', ')} provided)`
                    : ''}
                  .
                </p>
              </>
            ) : (
              <p className="font-medium text-flag">{result.error}</p>
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}

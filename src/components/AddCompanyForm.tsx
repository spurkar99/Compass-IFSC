'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Result {
  ok: boolean;
  error?: string;
  entity?: { id: string; name: string };
}

export function AddCompanyForm({ entityTypes }: { entityTypes: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState({
    name: '',
    entityType: '',
    category: '',
    aum: '',
    jurisdiction: 'GIFT IFSC, Gandhinagar',
    activities: '',
    licenses: '',
    officerName: '',
    officerEmail: '',
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function set(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const payload = (await response.json()) as Result;
      setResult(payload);
      if (payload.ok) router.refresh();
    } catch (caught) {
      setResult({ ok: false, error: caught instanceof Error ? caught.message : 'Failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Register a company</h2>
        {!open ? (
          <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
            + Add a company
          </button>
        ) : (
          <button
            type="button"
            className="text-[12px] text-ink-muted hover:text-ink"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        )}
      </div>

      {open ? (
        <form className="card-body space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="co-name">Company name</label>
              <input
                id="co-name"
                className="field"
                value={fields.name}
                onChange={(event) => set('name', event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="co-type">Entity type</label>
              <input
                id="co-type"
                className="field"
                list="entity-types"
                value={fields.entityType}
                onChange={(event) => set('entityType', event.target.value)}
                placeholder="e.g. Fund Management Entity"
              />
              <datalist id="entity-types">
                {entityTypes.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="co-category">Category</label>
              <input
                id="co-category"
                className="field"
                value={fields.category}
                onChange={(event) => set('category', event.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="co-aum">AUM (USD millions)</label>
              <input
                id="co-aum"
                className="field"
                type="number"
                min="0"
                value={fields.aum}
                onChange={(event) => set('aum', event.target.value)}
                placeholder="blank if not applicable"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="co-juris">Jurisdiction</label>
              <input
                id="co-juris"
                className="field"
                value={fields.jurisdiction}
                onChange={(event) => set('jurisdiction', event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="co-activities">Activities</label>
              <textarea
                id="co-activities"
                className="field min-h-[68px]"
                value={fields.activities}
                onChange={(event) => set('activities', event.target.value)}
                placeholder="One per line"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="co-licenses">Licences</label>
              <textarea
                id="co-licenses"
                className="field min-h-[68px]"
                value={fields.licenses}
                onChange={(event) => set('licenses', event.target.value)}
                placeholder="One per line"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="co-officer">Compliance officer</label>
              <input
                id="co-officer"
                className="field"
                value={fields.officerName}
                onChange={(event) => set('officerName', event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="co-email">Their email</label>
              <input
                id="co-email"
                type="email"
                className="field"
                value={fields.officerEmail}
                onChange={(event) => set('officerEmail', event.target.value)}
              />
              <p className="field-hint">Rule-change notifications go here.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-accent" disabled={busy}>
              {busy ? 'Registering…' : 'Register company'}
            </button>
            <span className="text-[12px] text-ink-muted">
              Rules already in force apply to it immediately.
            </span>
          </div>

          {result ? (
            <div
              className={`rounded border px-3 py-2.5 text-[13px] ${
                result.ok ? 'border-pass/30 bg-pass-bg' : 'border-flag/30 bg-flag-bg'
              }`}
            >
              {result.ok && result.entity ? (
                <p className="font-medium text-ink">
                  {result.entity.name} registered as <code>{result.entity.id}</code>. It now appears
                  in the entity switcher — add its roster next.
                </p>
              ) : (
                <p className="font-medium text-flag">{result.error}</p>
              )}
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}

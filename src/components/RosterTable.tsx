'use client';

import { Fragment, useState } from 'react';
import type { CheckResult, Employee, Rule, StatusTally } from '@/types';
import { StatusPill, type PillStatus } from './StatusPill';

export interface RosterRow {
  employee: Employee;
  results: CheckResult[];
  worstStatus: PillStatus;
  tally: StatusTally;
}

function missingFields(employee: Employee): string[] {
  const missing: string[] = [];
  if (employee.qualifications === null || employee.qualifications === undefined) {
    missing.push('qualifications');
  }
  if (employee.certifications === null || employee.certifications === undefined) {
    missing.push('certifications');
  }
  if (employee.experienceYears === null || employee.experienceYears === undefined) {
    missing.push('years of experience');
  }
  return missing;
}

type Filter = 'ATTENTION' | 'FAIL' | 'UNKNOWN' | 'ALL';

/** Flagged first, then needs-review, then met — the order work gets done in. */
const RANK: Record<PillStatus, number> = {
  FAIL: 0,
  UNKNOWN: 1,
  PASS: 2,
  NOT_IN_SCOPE: 3,
};

export function RosterTable({
  rows,
  rulesById,
  action,
}: {
  rows: RosterRow[];
  rulesById: Record<string, Pick<Rule, 'id' | 'title' | 'citationRef'>>;
  /** Rendered in the card header, e.g. the "Add an employee" control. */
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ATTENTION');
  const [query, setQuery] = useState('');

  const counts = {
    FAIL: rows.filter((row) => row.worstStatus === 'FAIL').length,
    UNKNOWN: rows.filter((row) => row.worstStatus === 'UNKNOWN').length,
    ALL: rows.length,
  };
  const attentionCount = counts.FAIL + counts.UNKNOWN;

  const search = query.trim().toLowerCase();
  const visible = rows
    .filter((row) => {
      if (filter === 'FAIL') return row.worstStatus === 'FAIL';
      if (filter === 'UNKNOWN') return row.worstStatus === 'UNKNOWN';
      if (filter === 'ATTENTION') {
        return row.worstStatus === 'FAIL' || row.worstStatus === 'UNKNOWN';
      }
      return true;
    })
    .filter((row) => {
      if (!search) return true;
      return (
        row.employee.name.toLowerCase().includes(search) ||
        row.employee.role.toLowerCase().includes(search) ||
        row.employee.id.toLowerCase().includes(search)
      );
    })
    .sort(
      (a, b) =>
        RANK[a.worstStatus] - RANK[b.worstStatus] ||
        a.employee.name.localeCompare(b.employee.name),
    );

  const TABS: Array<{ key: Filter; label: string; count: number; tone: string }> = [
    { key: 'ATTENTION', label: 'Needs attention', count: attentionCount, tone: 'text-ink' },
    { key: 'FAIL', label: 'Flagged', count: counts.FAIL, tone: 'text-flag' },
    { key: 'UNKNOWN', label: 'Needs review', count: counts.UNKNOWN, tone: 'text-review' },
    { key: 'ALL', label: 'Everyone', count: counts.ALL, tone: 'text-ink' },
  ];

  return (
    <section className="card overflow-hidden">
      <div className="card-head">
        <h2 className="card-title">
          Employee roster
          <span className="ml-2 font-normal text-ink-muted">{rows.length}</span>
        </h2>
        {/* `action` is created by the parent page, so it is wrapped in an element
            this component owns — otherwise React reconciles it as an unkeyed
            item in the header's child array and warns about a missing key. */}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-5 py-3">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded border px-3 py-1.5 text-[12px] transition-colors ${
                filter === tab.key
                  ? 'border-accent bg-accent-soft font-medium text-accent'
                  : 'border-line bg-surface text-ink-body hover:bg-white'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 font-semibold ${filter === tab.key ? '' : tab.tone}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <input
          type="search"
          className="field w-full sm:w-56"
          placeholder="Search name or role…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="border-b border-line bg-canvas">
            <tr>
              <th className="th w-8" />
              <th className="th">Employee</th>
              <th className="th">Role</th>
              <th className="th">Experience</th>
              <th className="th">Checks</th>
              <th className="th">Overall</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row) => {
              const isOpen = open === row.employee.id;
              const gaps = missingFields(row.employee);
              return (
                <Fragment key={row.employee.id}>
                  <tr
                    className={`cursor-pointer transition-colors hover:bg-canvas ${
                      isOpen ? 'bg-canvas' : ''
                    }`}
                    onClick={() => setOpen(isOpen ? null : row.employee.id)}
                  >
                    <td className="td text-ink-muted">
                      <span
                        className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        aria-hidden
                      >
                        ›
                      </span>
                    </td>
                    <td className="td">
                      <div className="font-medium text-ink">{row.employee.name}</div>
                      <div className="text-[12px] text-ink-muted">{row.employee.id}</div>
                    </td>
                    <td className="td">{row.employee.role}</td>
                    <td className="td">
                      {typeof row.employee.experienceYears === 'number'
                        ? `${row.employee.experienceYears} years`
                        : <span className="text-review">Not provided</span>}
                    </td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                        {row.tally.pass > 0 ? (
                          <span className="rounded bg-pass-bg px-1.5 py-0.5 font-medium text-pass">
                            {row.tally.pass} met
                          </span>
                        ) : null}
                        {row.tally.flagged > 0 ? (
                          <span className="rounded bg-flag-bg px-1.5 py-0.5 font-medium text-flag">
                            {row.tally.flagged} flagged
                          </span>
                        ) : null}
                        {row.tally.needsReview > 0 ? (
                          <span className="rounded bg-review-bg px-1.5 py-0.5 font-medium text-review">
                            {row.tally.needsReview} needs review
                          </span>
                        ) : null}
                        {row.results.length === 0 ? (
                          <span className="text-ink-muted">Not targeted</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="td">
                      <StatusPill status={row.worstStatus} />
                    </td>
                  </tr>

                  {isOpen ? (
                    <tr className="bg-canvas">
                      <td className="td" />
                      <td className="td" colSpan={5}>
                        {gaps.length > 0 ? (
                          <div className="mb-3 rounded border border-review/30 bg-review-bg px-3 py-2 text-[12px] text-ink-body">
                            <span className="font-semibold text-review">Not provided:</span>{' '}
                            {gaps.join(', ')} — reported as needs review, never a failure.
                          </div>
                        ) : null}

                        {row.results.length === 0 ? (
                          <p className="text-[13px] text-ink-muted">
                            No rule in force targets &ldquo;{row.employee.role}&rdquo; here.
                          </p>
                        ) : (
                          <ul className="space-y-2.5">
                            {row.results.map((result) => {
                              const rule = rulesById[result.ruleId];
                              return (
                                <li
                                  key={`${result.employeeId}-${result.ruleId}`}
                                  className="rounded border border-line bg-surface px-4 py-3"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-[13px] font-medium text-ink">
                                        {rule?.title ?? result.ruleId}
                                      </div>
                                      <div className="mt-0.5 text-[12px] text-ink-muted">
                                        {result.ruleId} · {rule?.citationRef ?? 'citation unavailable'}
                                      </div>
                                    </div>
                                    <StatusPill status={result.status} />
                                  </div>
                                  <dl className="mt-3 grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2">
                                    <div>
                                      <dt className="font-semibold uppercase tracking-wide text-ink-muted">
                                        Rule requires
                                      </dt>
                                      <dd className="mt-0.5 text-ink-body">{result.expected}</dd>
                                    </div>
                                    <div>
                                      <dt className="font-semibold uppercase tracking-wide text-ink-muted">
                                        On record
                                      </dt>
                                      <dd className="mt-0.5 text-ink-body">{result.actual}</dd>
                                    </div>
                                  </dl>
                                  <p className="mt-2.5 text-[12px] leading-relaxed text-ink-body">
                                    {result.reason}
                                  </p>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-ink-muted">
          {search
            ? `Nobody matching “${query}”.`
            : filter === 'ATTENTION'
              ? 'Nothing needs attention — every check on this roster is met.'
              : 'Nobody in this category.'}
        </p>
      ) : null}
    </section>
  );
}

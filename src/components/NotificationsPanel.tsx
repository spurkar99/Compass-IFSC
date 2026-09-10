'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AffectedPerson, Notification } from '@/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { StatusPill } from './StatusPill';

function PersonRow({ person, tone }: { person: AffectedPerson; tone: 'flag' | 'review' | 'pass' }) {
  const border =
    tone === 'flag' ? 'border-flag/25 bg-flag-bg' : tone === 'review' ? 'border-review/25 bg-review-bg' : 'border-pass/25 bg-pass-bg';
  return (
    <li className={`rounded border px-4 py-3 ${border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-[13px] font-semibold text-ink">{person.name}</span>
          <span className="ml-2 text-[12px] text-ink-muted">
            {person.role} · {person.employeeId}
          </span>
        </div>
        <StatusPill status={person.status} />
      </div>
      <dl className="mt-2.5 grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="font-semibold uppercase tracking-wide text-ink-muted">Rule requires</dt>
          <dd className="mt-0.5 text-ink-body">{person.expected}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wide text-ink-muted">On record</dt>
          <dd className="mt-0.5 text-ink-body">{person.actual}</dd>
        </div>
      </dl>
      <p className="mt-2 text-[12px] leading-relaxed text-ink-body">
        <span className="font-semibold text-ink">The gap: </span>
        {person.reason}
      </p>
    </li>
  );
}

function NotificationCard({ notification }: { notification: Notification }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<null | 'confirm' | 'memo'>(null);
  const [error, setError] = useState<string | null>(null);
  const isNew = notification.status === 'NEW';
  const affectedCount = notification.newlyFlagged.length + notification.newlyNeedsReview.length;

  async function confirmReview() {
    setBusy('confirm');
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${notification.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, reviewedBy: notification.officer.name }),
      });
      if (!response.ok) throw new Error(await response.text());
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the review.');
    } finally {
      setBusy(null);
    }
  }

  async function generateMemo() {
    setBusy('memo');
    setError(null);
    try {
      const response = await fetch(`/api/notifications/${notification.id}/memo`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error(await response.text());
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate the memo.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className={`rounded-card border bg-surface ${
        isNew ? 'border-flag/40 shadow-lifted ring-1 ring-flag/10' : 'border-line shadow-card'
      }`}
    >
      <header className={`flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4 ${
        isNew ? 'border-flag/20 bg-flag-bg' : 'border-line bg-canvas'
      }`}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                isNew ? 'bg-flag text-white' : 'bg-pass text-white'
              }`}
            >
              {isNew ? 'Action needed' : 'Reviewed & confirmed'}
            </span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              {notification.changeType === 'RULE_ADDED' ? 'New guideline' : 'Guideline updated'}
              {notification.rule.version > 1 ? ` · version ${notification.rule.version}` : ''}
            </span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug text-ink">
            {notification.rule.title}
          </h3>
          <p className="mt-1 text-[12px] text-ink-muted">
            Raised {formatDateTime(notification.createdAt)} · to{' '}
            <span className="font-medium text-ink-body">{notification.officer.name}</span>{' '}
            ({notification.officer.email}) at {notification.entityName}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-[26px] font-semibold leading-none ${affectedCount ? 'text-flag' : 'text-pass'}`}>
            {affectedCount}
          </div>
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">
            {affectedCount === 1 ? 'person affected' : 'people affected'}
          </div>
        </div>
      </header>

      <div className="space-y-5 px-5 py-5">
        {/* 1. THE POLICY */}
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Policy
          </h4>
          <p className="mt-2 text-[13px] font-medium text-ink">{notification.rule.citationRef}</p>
          <blockquote className="citation mt-2">&ldquo;{notification.rule.citationText}&rdquo;</blockquote>
          <dl className="mt-3 grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-3">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-muted">Effective from</dt>
              <dd className="mt-0.5 text-ink-body">{formatDate(notification.rule.effectiveDate)}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-muted">Applies to</dt>
              <dd className="mt-0.5 text-ink-body">
                {Array.isArray(notification.rule.targetRole)
                  ? notification.rule.targetRole.join(', ')
                  : notification.rule.targetRole === '*'
                    ? 'All employees'
                    : notification.rule.targetRole}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-muted">Reference</dt>
              <dd className="mt-0.5 text-ink-body">{notification.rule.id}</dd>
            </div>
          </dl>
          {notification.previousRule ? (
            <p className="mt-3 rounded border border-line bg-canvas px-3 py-2 text-[12px] text-ink-body">
              <span className="font-semibold text-ink">What changed: </span>
              version {notification.previousRule.version} required{' '}
              <span className="font-medium">
                {String(notification.previousRule.requirement.value)}
              </span>
              ; version {notification.rule.version} requires{' '}
              <span className="font-medium">{String(notification.rule.requirement.value)}</span>.
            </p>
          ) : null}
        </section>

        {/* 2. THE PEOPLE AND THE GAP */}
        <section>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Who is affected
          </h4>

          {notification.newlyFlagged.length > 0 ? (
            <div className="mt-2">
              <p className="text-[13px] font-medium text-ink">
                {notification.newlyFlagged.length}{' '}
                {notification.newlyFlagged.length === 1 ? 'person is' : 'people are'} newly flagged
                for review
              </p>
              <ul className="mt-2 space-y-2">
                {notification.newlyFlagged.map((person) => (
                  <PersonRow key={person.employeeId} person={person} tone="flag" />
                ))}
              </ul>
            </div>
          ) : null}

          {notification.newlyNeedsReview.length > 0 ? (
            <div className="mt-3">
              <p className="text-[13px] font-medium text-ink">
                {notification.newlyNeedsReview.length} newly need review — data missing, not a failure
              </p>
              <ul className="mt-2 space-y-2">
                {notification.newlyNeedsReview.map((person) => (
                  <PersonRow key={person.employeeId} person={person} tone="review" />
                ))}
              </ul>
            </div>
          ) : null}

          {notification.noLongerFlagged.length > 0 ? (
            <div className="mt-3">
              <p className="text-[13px] font-medium text-ink">
                {notification.noLongerFlagged.length} no longer flagged after this change
              </p>
              <ul className="mt-2 space-y-2">
                {notification.noLongerFlagged.map((person) => (
                  <PersonRow key={person.employeeId} person={person} tone="pass" />
                ))}
              </ul>
            </div>
          ) : null}

          {affectedCount === 0 && notification.noLongerFlagged.length === 0 ? (
            <p className="mt-2 rounded border border-pass/25 bg-pass-bg px-4 py-3 text-[13px] text-ink-body">
              This guideline applies to {notification.entityName}, but nobody is newly affected on
              the data held. Acknowledge and move on.
            </p>
          ) : null}
        </section>

        {/* 3. THE IMPACT MEMO (optional AI garnish) */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              Impact memo
            </h4>
            <button
              type="button"
              className="btn-secondary"
              onClick={generateMemo}
              disabled={busy !== null}
            >
              {busy === 'memo'
                ? 'Writing…'
                : notification.impactMemo
                  ? 'Regenerate memo'
                  : 'Generate memo'}
            </button>
          </div>
          {notification.impactMemo ? (
            <div className="mt-2 rounded border border-line bg-canvas px-4 py-3">
              <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink-body">
                {notification.impactMemo.text}
              </p>
              <p className="mt-3 text-[11px] text-ink-muted">
                {notification.impactMemo.source === 'bedrock'
                  ? `Written by ${notification.impactMemo.model ?? 'Claude on Bedrock'} from the findings above.`
                  : 'Template text — Bedrock not configured, so no AI was called.'}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-ink-muted">
              A short note you could forward. Wording only — it never changes who is flagged.
            </p>
          )}
        </section>

        {/* 4. OFFICER DECISION */}
        <section className="border-t border-line pt-4">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Officer review
          </h4>
          {isNew ? (
            <>
              <label className="mt-2 block">
                <span className="field-label">
                  Note from {notification.officer.name} (optional)
                </span>
                <textarea
                  className="field min-h-[72px]"
                  placeholder="e.g. Both fund managers booked onto the NISM XIX-C exam for 12 September; interim sign-off by the Principal Officer."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={confirmReview}
                  disabled={busy !== null}
                >
                  {busy === 'confirm' ? 'Saving…' : 'Confirm review'}
                </button>
                <span className="text-[12px] text-ink-muted">
                  Nothing is final until a person confirms.
                </span>
              </div>
            </>
          ) : (
            <div className="mt-2 rounded border border-pass/25 bg-pass-bg px-4 py-3 text-[13px] text-ink-body">
              <p>
                <span className="font-semibold text-ink">Reviewed and confirmed</span> by{' '}
                {notification.reviewedBy ?? notification.officer.name} on{' '}
                {formatDateTime(notification.reviewedAt)}.
              </p>
              {notification.reviewNote ? (
                <p className="mt-2 italic">&ldquo;{notification.reviewNote}&rdquo;</p>
              ) : (
                <p className="mt-1 text-[12px] text-ink-muted">No note recorded.</p>
              )}
            </div>
          )}
          {error ? (
            <p className="mt-3 rounded border border-flag/30 bg-flag-bg px-3 py-2 text-[12px] text-flag">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </article>
  );
}

export function NotificationsPanel({ notifications }: { notifications: Notification[] }) {
  const newCount = notifications.filter((item) => item.status === 'NEW').length;

  return (
    <section className="card overflow-hidden">
      <div className={`card-head ${newCount > 0 ? 'bg-flag-bg' : ''}`}>
        <div>
          <h2 className="card-title flex items-center gap-2">
            Notifications to the compliance officer
            {newCount > 0 ? (
              <span className="rounded-full bg-flag px-2 py-0.5 text-[11px] font-semibold text-white">
                {newCount} new
              </span>
            ) : null}
          </h2>
          <p className="card-sub">Raised when a guideline is added or changed.</p>
        </div>
      </div>
      <div className="card-body">
        {notifications.length === 0 ? (
          <div className="rounded border border-dashed border-line bg-canvas px-5 py-8 text-center">
            <p className="text-[13px] font-medium text-ink">No notifications.</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed text-ink-muted">
              File a guideline on <span className="font-medium text-accent">Rules &amp; guidelines</span>{' '}
              and any gap it opens on this roster appears here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

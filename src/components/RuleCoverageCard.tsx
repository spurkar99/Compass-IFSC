import Link from 'next/link';
import type { RuleEvaluation } from '@/types';
import { describeTargetRole } from '@/lib/normalize';
import { describeRequirement } from '@/lib/engine';

/**
 * Which rules reach this entity, and which do not — with the reason. This is
 * how you can see at a glance that entity-conditional rules are working.
 */
export function RuleCoverageCard({ evaluations }: { evaluations: RuleEvaluation[] }) {
  const applying = evaluations.filter((item) => item.applies);
  const notApplying = evaluations.filter((item) => !item.applies);

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Requirements in force</h2>
          <p className="card-sub">
            {applying.length} of {evaluations.length} rules reach this entity.
          </p>
        </div>
        <Link href="/rules" className="text-[13px] font-medium text-accent hover:underline">
          Manage guidelines →
        </Link>
      </div>
      <div className="card-body space-y-3">
        {applying.map((item) => {
          const flagged = item.results.filter((result) => result.status === 'FAIL').length;
          const review = item.results.filter((result) => result.status === 'UNKNOWN').length;
          return (
            <div key={item.rule.id} className="rounded border border-line px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-ink">{item.rule.title}</div>
                  <div className="mt-0.5 text-[12px] text-ink-muted">
                    {item.rule.id} · {describeTargetRole(item.rule.targetRole)} ·{' '}
                    {describeRequirement(item.rule)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5 text-[11px] font-medium">
                  {flagged > 0 ? (
                    <span className="rounded bg-flag-bg px-1.5 py-0.5 text-flag">{flagged} flagged</span>
                  ) : null}
                  {review > 0 ? (
                    <span className="rounded bg-review-bg px-1.5 py-0.5 text-review">
                      {review} needs review
                    </span>
                  ) : null}
                  {flagged === 0 && review === 0 && item.results.length > 0 ? (
                    <span className="rounded bg-pass-bg px-1.5 py-0.5 text-pass">
                      all {item.results.length} met
                    </span>
                  ) : null}
                  {item.noTargetRoleHolders ? (
                    <span className="rounded bg-canvas px-1.5 py-0.5 text-ink-muted">
                      nobody holds this role
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {notApplying.length > 0 ? (
          <details className="rounded border border-line bg-canvas px-4 py-3">
            <summary className="cursor-pointer text-[13px] font-medium text-ink">
              {notApplying.length} rule{notApplying.length === 1 ? '' : 's'} do not apply — why?
            </summary>
            <ul className="mt-3 space-y-2">
              {notApplying.map((item) => (
                <li key={item.rule.id} className="text-[12px] leading-relaxed">
                  <span className="font-medium text-ink">{item.rule.id}</span>{' '}
                  <span className="text-ink-body">{item.rule.title}</span>
                  <span
                    className={`mt-0.5 block ${
                      item.applicabilityNeedsReview ? 'text-review' : 'text-ink-muted'
                    }`}
                  >
                    {item.applicabilityReason}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </section>
  );
}

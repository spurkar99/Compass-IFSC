import { PageHeader } from '@/components/PageHeader';
import { formatDate } from '@/lib/dates';
import { runSelfChecks } from '@/lib/selfcheck';

export const dynamic = 'force-dynamic';

export default async function SelfCheckPage() {
  const report = await runSelfChecks();
  const groups = Array.from(new Set(report.outcomes.map((outcome) => outcome.group)));
  const allGood = report.failed === 0;

  return (
    <>
      <PageHeader
        title="Engine self-check"
        subtitle={`Expectations worked out by hand from the seed data, compared against what the engine returns. As of ${formatDate(report.asOfDate)}.`}
      />

      <div className="space-y-6 p-6">
        <div
          className={`card border-l-[3px] px-5 py-4 ${
            allGood ? 'border-l-pass' : 'border-l-flag'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={`text-[20px] font-semibold ${allGood ? 'text-pass' : 'text-flag'}`}>
                {report.passed} of {report.outcomes.length} expectations met
              </p>
              <p className="mt-1 text-[13px] text-ink-body">
                {allGood
                  ? 'The engine agrees with every hand-worked answer.'
                  : `${report.failed} expectation${report.failed === 1 ? '' : 's'} did not match — see the rows marked below.`}
              </p>
            </div>
            <p className="text-[12px] text-ink-muted">
              Also runnable as <code className="rounded bg-canvas px-1">npm run verify</code>
            </p>
          </div>
        </div>

        {groups.map((group) => {
          const rows = report.outcomes.filter((outcome) => outcome.group === group);
          return (
            <section key={group} className="card overflow-hidden">
              <div className="card-head">
                <h2 className="card-title">{group}</h2>
                <span className="text-[12px] text-ink-muted">
                  {rows.filter((row) => row.ok).length}/{rows.length} met
                </span>
              </div>
              <ul className="divide-y divide-line">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        row.ok ? 'bg-pass-bg text-pass' : 'bg-flag-bg text-flag'
                      }`}
                    >
                      {row.ok ? 'met' : 'not met'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] text-ink-body">{row.description}</p>
                      {!row.ok ? (
                        <p className="mt-1 text-[12px] text-flag">
                          expected <code className="rounded bg-canvas px-1">{row.expected}</code>,
                          got <code className="rounded bg-canvas px-1">{row.actual}</code>
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

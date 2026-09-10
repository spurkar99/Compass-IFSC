import { RulesWorkbench } from '@/components/RulesWorkbench';
import { PageHeader } from '@/components/PageHeader';
import { formatDate } from '@/lib/dates';
import { describeRequirement } from '@/lib/engine';
import { describeTargetRole } from '@/lib/normalize';
import {
  getActiveRules,
  getAllRules,
  getDemoGuideline,
  getEmployees,
  getEntities,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

function FilterSummary({ filter }: { filter: Record<string, unknown> }) {
  const parts: string[] = [];
  if (filter.entityType) parts.push(`type: ${String(filter.entityType)}`);
  if (filter.category) parts.push(`category: ${String(filter.category)}`);
  if (filter.minAum) parts.push(`AUM above USD ${String(filter.minAum)}m`);
  if (filter.activity) parts.push(`activity: ${String(filter.activity)}`);
  if (filter.license) parts.push(`licence: ${String(filter.license)}`);
  return <>{parts.length ? parts.join(' · ') : 'every entity'}</>;
}

export default async function RulesPage() {
  const entities = await getEntities();
  const employees = await getEmployees();
  const activeRules = await getActiveRules();
  const allRules = await getAllRules();
  const demoGuideline = await getDemoGuideline();

  const superseded = allRules.filter((rule) => rule.status === 'SUPERSEDED');
  const entityTypes = Array.from(new Set(entities.map((entity) => entity.entityType))).sort();
  const knownRoles = Array.from(new Set(employees.map((employee) => employee.role))).sort();

  return (
    <>
      <PageHeader
        title="Guidelines"
        subtitle="Two agents read a circular and check each other's work. You approve. Then every roster is re-checked."
      />

      <div className="space-y-6 p-6">
        <RulesWorkbench
          entityTypes={entityTypes}
          knownRoles={knownRoles}
          activeRules={activeRules.map((rule) => ({
            id: rule.id,
            title: rule.title,
            version: rule.version,
          }))}
          demoGuideline={demoGuideline}
        />

        <section className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">Requirements in force</h2>
              <p className="card-sub">{activeRules.length} rules</p>
            </div>
          </div>
          <div className="card-body space-y-4">
            {activeRules.map((rule) => (
              <article key={`${rule.id}-v${rule.version}`} className="rounded border border-line px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-semibold text-ink">{rule.title}</h3>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {rule.id} · version {rule.version} · effective {formatDate(rule.effectiveDate)}
                      {rule.source === 'GUIDELINE_FORM' ? ' · filed through the form' : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-medium text-accent ring-1 ring-accent/20">
                    In force
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-ink-muted">Reaches</dt>
                    <dd className="mt-0.5 text-ink-body">
                      <FilterSummary filter={rule.appliesToEntityFilter as Record<string, unknown>} />
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-ink-muted">Targets</dt>
                    <dd className="mt-0.5 text-ink-body">{describeTargetRole(rule.targetRole)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase tracking-wide text-ink-muted">Requires</dt>
                    <dd className="mt-0.5 text-ink-body">{describeRequirement(rule)}</dd>
                  </div>
                </dl>

                <details className="mt-3 border-t border-line pt-3">
                  <summary className="cursor-pointer text-[12px] font-medium text-accent">
                    Source text
                  </summary>
                  <p className="mt-2 text-[13px] font-medium text-ink">{rule.citationRef}</p>
                  <blockquote className="citation mt-2">&ldquo;{rule.citationText}&rdquo;</blockquote>
                  {rule.citationSource ? (
                    <p className="mt-2 text-[11px] italic leading-relaxed text-ink-muted">
                      Provenance: {rule.citationSource}
                    </p>
                  ) : null}
                </details>
              </article>
            ))}
          </div>
        </section>

        {superseded.length > 0 ? (
          <section className="card">
            <div className="card-head">
              <div>
                <h2 className="card-title">Superseded versions</h2>
                <p className="card-sub">Nothing is deleted — earlier wording stays visible.</p>
              </div>
            </div>
            <div className="card-body space-y-2">
              {superseded.map((rule) => (
                <div
                  key={`${rule.id}-v${rule.version}`}
                  className="rounded border border-line bg-canvas px-4 py-3 text-[12px]"
                >
                  <span className="font-medium text-ink">
                    {rule.id} version {rule.version}
                  </span>{' '}
                  <span className="text-ink-body">{rule.title}</span>
                  <span className="mt-0.5 block text-ink-muted">
                    Required: {describeRequirement(rule)} · targeted{' '}
                    {describeTargetRole(rule.targetRole)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

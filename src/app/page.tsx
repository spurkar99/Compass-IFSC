import Link from 'next/link';
import { AddEmployeeForm } from '@/components/AddEmployeeForm';
import { EntitySwitcher } from '@/components/EntitySwitcher';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { PageHeader } from '@/components/PageHeader';
import { RosterTable } from '@/components/RosterTable';
import { SummaryTiles } from '@/components/SummaryTiles';
import { formatDate } from '@/lib/dates';
import { evaluateEntity } from '@/lib/engine';
import {
  getActiveRules,
  getAsOfDate,
  getEmployees,
  getEntities,
  getNotifications,
} from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const params = await searchParams;
  const entities = await getEntities();
  const employees = await getEmployees();
  const rules = await getActiveRules();
  const asOfDate = await getAsOfDate();
  const allNotifications = await getNotifications();

  if (entities.length === 0) {
    return (
      <div className="p-6">
        <p className="card card-body text-[13px]">
          No companies registered yet — add one on the{' '}
          <Link href="/company" className="font-medium text-accent hover:underline">
            Company
          </Link>{' '}
          page.
        </p>
      </div>
    );
  }

  const entity = entities.find((item) => item.id === params.entity) ?? entities[0];
  const evaluation = evaluateEntity(entity, employees, rules, asOfDate);
  const notifications = allNotifications.filter((item) => item.entityId === entity.id);
  // The sidebar badge counts every entity, so name alerts sitting elsewhere
  // rather than leaving the count looking wrong.
  const elsewhere = allNotifications.filter(
    (item) => item.entityId !== entity.id && item.status === 'NEW',
  );

  const rulesById = Object.fromEntries(
    rules.map((rule) => [rule.id, { id: rule.id, title: rule.title, citationRef: rule.citationRef }]),
  );
  const knownRoles = Array.from(new Set(employees.map((item) => item.role))).sort();

  return (
    <>
      <PageHeader
        title={entity.name}
        subtitle={`${entity.entityType} · evaluated as of ${formatDate(asOfDate)}`}
        right={
          <>
            <EntitySwitcher entities={entities} activeId={entity.id} />
            <Link href="/rules" className="btn-accent">
              Add a guideline
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-6">
        <SummaryTiles
          headcount={evaluation.employees.length}
          tally={evaluation.tally}
          peopleFlagged={
            evaluation.perEmployee.filter((row) => row.worstStatus === 'FAIL').length
          }
          peopleNeedingReview={
            evaluation.perEmployee.filter((row) => row.worstStatus === 'UNKNOWN').length
          }
        />

        {elsewhere.length > 0 ? (
          <div className="rounded-card border border-review/30 bg-review-bg px-5 py-3 text-[13px]">
            <span className="font-semibold text-review">
              {elsewhere.length} new alert{elsewhere.length === 1 ? '' : 's'} elsewhere:
            </span>{' '}
            {Array.from(new Set(elsewhere.map((item) => item.entityId))).map((id, index, all) => {
              const match = elsewhere.find((item) => item.entityId === id)!;
              return (
                <span key={id}>
                  <Link href={`/?entity=${id}`} className="font-medium text-accent hover:underline">
                    {match.entityName}
                  </Link>
                  {index < all.length - 1 ? ', ' : ''}
                </span>
              );
            })}
          </div>
        ) : null}

        <NotificationsPanel notifications={notifications} />

        <RosterTable
          rows={evaluation.perEmployee}
          rulesById={rulesById}
          action={
            <AddEmployeeForm
              entityId={entity.id}
              entityName={entity.name}
              knownRoles={knownRoles}
            />
          }
        />
      </div>
    </>
  );
}

import Link from 'next/link';
import { AddCompanyForm } from '@/components/AddCompanyForm';
import { CsvUploadCard } from '@/components/CsvUploadCard';
import { EntityCard } from '@/components/EntityCard';
import { EntitySwitcher } from '@/components/EntitySwitcher';
import { PageHeader } from '@/components/PageHeader';
import { ResetButton } from '@/components/ResetButton';
import { RuleCoverageCard } from '@/components/RuleCoverageCard';
import { evaluateEntity } from '@/lib/engine';
import { getActiveRules, getAsOfDate, getEmployees, getEntities } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string }>;
}) {
  const params = await searchParams;
  const entities = await getEntities();
  const employees = await getEmployees();
  const rules = await getActiveRules();
  const asOfDate = await getAsOfDate();

  const entityTypes = Array.from(new Set(entities.map((entity) => entity.entityType))).sort();

  if (entities.length === 0) {
    return (
      <>
        <PageHeader title="Companies" subtitle="No companies registered yet." />
        <div className="p-6">
          <AddCompanyForm entityTypes={entityTypes} />
        </div>
      </>
    );
  }

  const entity = entities.find((item) => item.id === params.entity) ?? entities[0];
  const evaluation = evaluateEntity(entity, employees, rules, asOfDate);

  return (
    <>
      <PageHeader
        title="Companies"
        subtitle="Company details, which requirements reach it, and how its roster gets loaded."
        right={
          <>
            <EntitySwitcher entities={entities} activeId={entity.id} basePath="/company" />
            <ResetButton />
          </>
        }
      />

      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <EntityCard entity={entity} />
            <CsvUploadCard entityId={entity.id} entityName={entity.name} />
          </div>
          <div className="space-y-6">
            <RuleCoverageCard evaluations={evaluation.evaluations} />
            <AddCompanyForm entityTypes={entityTypes} />
          </div>
        </div>

        <p className="text-[12px] text-ink-muted">
          To add a single person, use{' '}
          <Link href={`/?entity=${entity.id}`} className="font-medium text-accent hover:underline">
            + Add an employee
          </Link>{' '}
          on the dashboard roster.
        </p>
      </div>
    </>
  );
}

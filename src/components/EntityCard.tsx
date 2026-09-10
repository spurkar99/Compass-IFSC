import type { Entity } from '@/types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-[13px] text-ink-body">{children}</dd>
    </div>
  );
}

export function EntityCard({ entity }: { entity: Entity }) {
  const { characteristics: traits } = entity;
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Company profile</h2>
      </div>
      <div className="card-body">
        <dl className="divide-y divide-line">
          <Row label="Legal name">{entity.name}</Row>
          <Row label="Entity type">{entity.entityType}</Row>
          <Row label="Category">{traits.category ?? '—'}</Row>
          <Row label="Assets under management">
            {typeof traits.aum === 'number'
              ? `USD ${traits.aum}m`
              : 'Not recorded'}
          </Row>
          <Row label="Jurisdiction">{traits.jurisdiction ?? '—'}</Row>
          <Row label="Activities">
            <ul className="space-y-1">
              {entity.activities.map((activity) => (
                <li key={activity}>{activity}</li>
              ))}
            </ul>
          </Row>
          <Row label="Licences">
            <ul className="space-y-1">
              {entity.licenses.map((license) => (
                <li key={license} className="font-medium text-ink">
                  {license}
                </li>
              ))}
            </ul>
          </Row>
          <Row label="Compliance officer">
            <span className="font-medium text-ink">{entity.complianceOfficer.name}</span>
            <span className="block text-ink-muted">{entity.complianceOfficer.email}</span>
          </Row>
        </dl>
      </div>
    </section>
  );
}

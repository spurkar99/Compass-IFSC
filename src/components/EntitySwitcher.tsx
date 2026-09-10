import Link from 'next/link';
import type { Entity } from '@/types';

/** Compact tab strip. Sits inline in the page header to save a whole row. */
export function EntitySwitcher({
  entities,
  activeId,
  basePath = '/',
}: {
  entities: Entity[];
  activeId: string;
  basePath?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {entities.map((entity) => {
        const active = entity.id === activeId;
        return (
          <Link
            key={entity.id}
            href={`${basePath}?entity=${entity.id}`}
            title={entity.entityType}
            className={`rounded border px-3 py-1.5 text-[13px] transition-colors ${
              active
                ? 'border-accent bg-accent-soft font-medium text-accent'
                : 'border-line bg-surface text-ink-body hover:bg-canvas'
            }`}
          >
            {entity.name.replace(/ (Pvt\.|IFSC) Ltd\.?$/, '')}
          </Link>
        );
      })}
    </div>
  );
}

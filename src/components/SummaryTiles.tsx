import type { StatusTally } from '@/types';

/**
 * Four numbers, in the order a compliance officer cares about them.
 *
 * The unit is stated in every label, because "4 checks needing review" and
 * "2 people needing review" can both be true at once (two people, two checks
 * each) and an unlabelled number invites the wrong reading.
 */
export function SummaryTiles({
  headcount,
  tally,
  peopleFlagged,
  peopleNeedingReview,
}: {
  headcount: number;
  tally: StatusTally;
  peopleFlagged: number;
  peopleNeedingReview: number;
}) {
  const totalChecks = tally.pass + tally.flagged + tally.needsReview;
  const tiles = [
    {
      label: 'People on roster',
      value: String(headcount),
      accent: 'text-ink',
      bar: 'border-l-line',
    },
    {
      label: 'Checks met',
      value: `${tally.pass}`,
      suffix: `of ${totalChecks}`,
      accent: 'text-pass',
      bar: 'border-l-pass',
    },
    {
      label: 'People flagged for review',
      value: String(peopleFlagged),
      suffix: `${tally.flagged} check${tally.flagged === 1 ? '' : 's'}`,
      accent: 'text-flag',
      bar: 'border-l-flag',
    },
    {
      label: 'People needing review',
      value: String(peopleNeedingReview),
      suffix: `${tally.needsReview} check${tally.needsReview === 1 ? '' : 's'}`,
      accent: 'text-review',
      bar: 'border-l-review',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className={`card border-l-[3px] ${tile.bar} px-5 py-4`}>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-[30px] font-semibold leading-none ${tile.accent}`}>
              {tile.value}
            </span>
            {tile.suffix ? (
              <span className="text-[12px] text-ink-muted">{tile.suffix}</span>
            ) : null}
          </div>
          <div className="mt-2 text-[12px] font-medium text-ink-muted">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}

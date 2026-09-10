import type { CheckStatus } from '@/types';

export type PillStatus = CheckStatus | 'NOT_IN_SCOPE';

/**
 * The wording here matters and is deliberate:
 *   FAIL    -> "Flagged for review"   (never "non-compliant")
 *   UNKNOWN -> "Needs review"         (missing data, not a failure)
 * A coloured dot plus a text label, so the meaning never depends on colour
 * alone — important on a projector and for anyone colour-blind.
 */
const LOOKUP: Record<PillStatus, { label: string; dot: string; text: string; bg: string; ring: string }> = {
  PASS: {
    label: 'Met',
    dot: 'bg-pass',
    text: 'text-pass',
    bg: 'bg-pass-bg',
    ring: 'ring-pass/20',
  },
  FAIL: {
    label: 'Flagged for review',
    dot: 'bg-flag',
    text: 'text-flag',
    bg: 'bg-flag-bg',
    ring: 'ring-flag/20',
  },
  UNKNOWN: {
    label: 'Needs review',
    dot: 'bg-review',
    text: 'text-review',
    bg: 'bg-review-bg',
    ring: 'ring-review/20',
  },
  NOT_IN_SCOPE: {
    label: 'Not targeted',
    dot: 'bg-ink-muted',
    text: 'text-ink-muted',
    bg: 'bg-canvas',
    ring: 'ring-line',
  },
};

export function StatusPill({
  status,
  label,
  className = '',
}: {
  status: PillStatus;
  label?: string;
  className?: string;
}) {
  const style = LOOKUP[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px]
                  font-medium ring-1 ${style.bg} ${style.text} ${style.ring} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      {label ?? style.label}
    </span>
  );
}

export function statusLabel(status: PillStatus): string {
  return LOOKUP[status].label;
}

// ---------------------------------------------------------------------------
// Date helpers. Everything is calculated in UTC from ISO `yyyy-mm-dd` strings
// so the same data always produces the same answer, whatever machine it runs on.
// ---------------------------------------------------------------------------

/** Parse an ISO date. Returns null for anything unusable. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match) {
    const [, y, m, d] = match;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  // Tolerate dd/mm/yyyy and dd-mm-yyyy, which is what spreadsheets often produce.
  const alt = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (alt) {
    const [, d, m, y] = alt;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const fallback = new Date(trimmed);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Whole months elapsed between two dates (partial months not counted). */
export function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return months;
}

/** Format an ISO date for display, e.g. "15 Mar 2024". */
export function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format a timestamp for display, e.g. "22 Aug 2026, 14:05". */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Today as `yyyy-mm-dd`. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

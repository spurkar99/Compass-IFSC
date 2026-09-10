// ---------------------------------------------------------------------------
// Text matching helpers.
//
// Real rosters are messy: "Principal Officer", "principal officer", "PO",
// "NISM Series XIX-C" vs "NISM-Series-XIX-C". All comparisons in the engine go
// through here so the matching is predictable and written down in one place.
// This is plain string handling — there is no AI or fuzzy guessing anywhere.
// ---------------------------------------------------------------------------

/** Lowercase, collapse whitespace, trim. Used for display-safe comparison. */
export function loose(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Lowercase and strip everything that is not a letter or digit. */
export function tight(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Common short forms for roles, mapped to the canonical role name.
 * Kept deliberately small and explicit — if a role is not listed here it is
 * compared on its normalised text, and a genuine mismatch simply means the
 * rule does not target that person.
 */
const ROLE_ALIASES: Record<string, string> = {
  po: 'principal officer',
  principalofficer: 'principal officer',
  co: 'compliance officer',
  complianceofficer: 'compliance officer',
  chiefcomplianceofficer: 'compliance officer',
  cco: 'compliance officer',
  fundmanager: 'fund manager',
  fundmgr: 'fund manager',
  portfoliomanager: 'fund manager',
  investmentmanager: 'fund manager',
  riskanalyst: 'risk analyst',
  riskofficer: 'risk analyst',
  cto: 'chief technology officer',
  chieftechnologyofficer: 'chief technology officer',
  opsmanager: 'operations manager',
  operationsmanager: 'operations manager',
};

/** Reduce a role name written any which way to a single canonical form. */
export function canonicalRole(role: string): string {
  const key = tight(role);
  return ROLE_ALIASES[key] ?? loose(role);
}

/** `true` when a rule's targetRole covers this employee's role. */
export function roleMatches(targetRole: string | string[], employeeRole: string): boolean {
  const targets = Array.isArray(targetRole) ? targetRole : [targetRole];
  const employee = canonicalRole(employeeRole);
  return targets.some((target) => {
    const t = target.trim();
    if (t === '*' || loose(t) === 'all employees' || loose(t) === 'all') return true;
    return canonicalRole(t) === employee;
  });
}

/**
 * `true` when two certification or qualification names refer to the same thing.
 * Exact after normalisation, or one clearly contains the other (so
 * "NISM-Series-XIX-C" matches the fuller title that includes it).
 */
export function credentialMatches(required: string, held: string): boolean {
  const a = tight(required);
  const b = tight(held);
  if (!a || !b) return false;
  if (a === b) return true;
  // Only allow containment when the shorter side is substantial, to avoid
  // accidental matches on very short strings.
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 6 && longer.includes(shorter);
}

/** Human-readable label for a role target. */
export function describeTargetRole(targetRole: string | string[]): string {
  const targets = Array.isArray(targetRole) ? targetRole : [targetRole];
  if (targets.some((t) => t.trim() === '*' || loose(t) === 'all employees')) {
    return 'All employees';
  }
  if (targets.length === 1) return targets[0];
  return `${targets.slice(0, -1).join(', ')} and ${targets[targets.length - 1]}`;
}

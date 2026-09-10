// ---------------------------------------------------------------------------
// Compass IFSC — the three core data models, plus the engine's output shapes.
//
// A note on `null` vs `[]`, because the whole product hinges on it:
//   - `null` / field absent  => "we were not given this data"  => UNKNOWN
//   - `[]` (empty list)      => "we know they hold none"       => can be a FAIL
// Never conflate the two.
// ---------------------------------------------------------------------------

/** A company operating in GIFT IFSC. */
export interface Entity {
  id: string;
  name: string;
  entityType: string;
  activities: string[];
  licenses: string[];
  characteristics: {
    category?: string;
    /** Assets under management, in USD millions. */
    aum?: number | null;
    aumCurrency?: string;
    jurisdiction?: string;
    headcount?: number;
    [key: string]: unknown;
  };
  complianceOfficer: {
    name: string;
    email: string;
  };
}

/** One certification held by an employee. Dates are ISO `yyyy-mm-dd`. */
export interface Certification {
  name: string;
  issuedDate?: string | null;
  expiryDate?: string | null;
}

/** A person on an entity's roster. Any field except id/entityId/name/role may be missing. */
export interface Employee {
  id: string;
  entityId: string;
  name: string;
  role: string;
  qualifications?: string[] | null;
  certifications?: Certification[] | null;
  experienceYears?: number | null;
  /** Free-text note carried through from the seed data or a CSV import. */
  _note?: string;
}

/** The kinds of check the engine knows how to perform. */
export type RequirementType =
  | 'HAS_CERTIFICATION'
  | 'CERTIFICATION_NOT_EXPIRED'
  | 'CERTIFICATION_RENEWED_WITHIN_MONTHS'
  | 'MIN_EXPERIENCE_YEARS'
  | 'HAS_QUALIFICATION';

export interface Requirement {
  type: RequirementType;
  /**
   * The threshold being tested.
   *  - HAS_CERTIFICATION / CERTIFICATION_NOT_EXPIRED : the certification name (string)
   *  - CERTIFICATION_RENEWED_WITHIN_MONTHS           : a number of months
   *  - MIN_EXPERIENCE_YEARS                          : a number of years
   *  - HAS_QUALIFICATION                             : one name, or a list meaning "any one of"
   */
  value: string | number | string[];
  /** Which certification the check is about, when `value` holds a number instead. */
  certificationName?: string;
}

/**
 * A rule only applies to an entity when EVERY field present here matches the
 * entity. An empty object means "applies to every entity".
 */
export interface EntityFilter {
  entityType?: string;
  category?: string;
  /** Applies only where the entity's AUM (USD millions) is at least this. */
  minAum?: number;
  activity?: string;
  license?: string;
}

/** A structured IFSCA requirement — the "door" all guidelines come through. */
export interface Rule {
  id: string;
  title: string;
  citationRef: string;
  citationText: string;
  /** Provenance note: where this citation text came from and how trustworthy it is. */
  citationSource?: string;
  appliesToEntityFilter: EntityFilter;
  /** A single role, a list of roles, or `"*"` for every employee. */
  targetRole: string | string[];
  requirement: Requirement;
  version: number;
  effectiveDate: string;
  status?: 'ACTIVE' | 'SUPERSEDED';
  source?: 'SEED' | 'GUIDELINE_FORM';
  createdAt?: string;
  /** Set on a new version to point at the version it replaced. */
  supersedesVersion?: number;
}

// --------------------------- engine output ---------------------------------

/**
 * PASS    — the employee's data meets the requirement.
 * FAIL    — the data is present and does not meet it. Surfaced as "flagged for review".
 * UNKNOWN — data needed for the check is missing. Never a failure.
 */
export type CheckStatus = 'PASS' | 'FAIL' | 'UNKNOWN';

export interface CheckResult {
  employeeId: string;
  employeeName: string;
  role: string;
  ruleId: string;
  status: CheckStatus;
  /** What the rule asks for, in plain language. */
  expected: string;
  /** What the roster actually holds. */
  actual: string;
  /** One-sentence explanation of the gap (or of why it passes). */
  reason: string;
}

export interface RuleEvaluation {
  rule: Rule;
  /** Did this rule apply to this entity at all? */
  applies: boolean;
  /** True when applicability could not be determined because entity data is missing. */
  applicabilityNeedsReview: boolean;
  /** Plain-language explanation of the applicability decision. */
  applicabilityReason: string;
  /** Empty when the rule does not apply, or when no employee holds the target role. */
  results: CheckResult[];
  /** Set when the rule applies but nobody currently holds the target role. */
  noTargetRoleHolders: boolean;
}

export interface StatusTally {
  pass: number;
  flagged: number;
  needsReview: number;
}

export interface EntityEvaluation {
  entity: Entity;
  employees: Employee[];
  evaluations: RuleEvaluation[];
  /** Counts across every check performed for this entity. */
  tally: StatusTally;
  /** The worst status seen per employee, for the roster table. */
  perEmployee: Array<{
    employee: Employee;
    results: CheckResult[];
    worstStatus: CheckStatus | 'NOT_IN_SCOPE';
    tally: StatusTally;
  }>;
  asOfDate: string;
}

// --------------------------- notifications ---------------------------------

/** One person named in a notification, with the exact gap. */
export interface AffectedPerson {
  employeeId: string;
  name: string;
  role: string;
  status: CheckStatus;
  expected: string;
  actual: string;
  reason: string;
  /** What the engine said about this person before the change, if anything. */
  previousStatus?: CheckStatus | 'NOT_APPLICABLE';
}

export interface ImpactMemo {
  text: string;
  source: 'bedrock' | 'fallback';
  generatedAt: string;
  model?: string;
}

export interface Notification {
  id: string;
  createdAt: string;
  entityId: string;
  entityName: string;
  officer: { name: string; email: string };
  changeType: 'RULE_ADDED' | 'RULE_UPDATED';
  rule: Rule;
  previousRule?: Pick<Rule, 'version' | 'requirement' | 'targetRole' | 'citationRef'> | null;
  /** People who moved INTO a flagged state because of this change. */
  newlyFlagged: AffectedPerson[];
  /** People who moved INTO "needs review" because of this change (missing data). */
  newlyNeedsReview: AffectedPerson[];
  /** People who were flagged before and no longer are. */
  noLongerFlagged: AffectedPerson[];
  status: 'NEW' | 'CONFIRMED';
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
  impactMemo?: ImpactMemo | null;
}

export interface AppConfig {
  asOfDate: string | null;
  productName: string;
}

// ------------------------- agentic rule intake ------------------------------
//
// Two agents sit in front of the guideline form. They never touch the engine and
// they never decide whether a person complies — they only turn a published
// circular into a structured draft rule, and check each other's work. A human
// approves before anything is filed.

/** One field of a draft rule, with the exact words it was derived from. */
export interface FieldEvidence {
  field: string;
  /** Verbatim quote from the source document. Empty means "not stated". */
  quote: string;
}

/** The structured rule a drafting agent proposes. Mirrors the guideline form. */
export interface DraftRule {
  title: string;
  citationRef: string;
  citationText: string;
  entityType: string;
  category: string;
  minAum: string;
  targetRoles: string[];
  allEmployees: boolean;
  requirementType: RequirementType | '';
  requirementValue: string;
  certificationName: string;
  effectiveDate: string;
}

export interface DraftResult {
  draft: DraftRule;
  evidence: FieldEvidence[];
  /** Anything the agent could not determine from the text. */
  notes: string[];
}

export type FindingSeverity = 'BLOCKER' | 'WARNING' | 'OK';

export interface AuditFinding {
  field: string;
  severity: FindingSeverity;
  issue: string;
  /** The words in the source that settle the point, if any. */
  quote: string;
  /** What the auditing agent believes the value should be. */
  suggested: string;
}

export interface AuditResult {
  verdict: 'APPROVE' | 'CORRECT' | 'REJECT';
  summary: string;
  findings: AuditFinding[];
  /** Present when the auditor changed something. */
  correctedDraft: DraftRule | null;
}

export interface IntakeResult {
  ok: boolean;
  error?: string;
  /** Set when Bedrock is unavailable — the panel explains itself rather than faking a draft. */
  unavailable?: boolean;
  sourceChars: number;
  drafting?: DraftResult;
  audit?: AuditResult;
  /** The values a human is asked to sign off, after deterministic repair. */
  proposed?: DraftRule;
  /** Findings from the deterministic schema check that runs after both agents. */
  schemaIssues?: Array<{
    field: string;
    severity: 'BLOCKER' | 'WARNING';
    issue: string;
    repairedTo?: string;
  }>;
  model?: string;
  timings?: { draftingMs: number; auditMs: number };
}

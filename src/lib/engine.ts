// ---------------------------------------------------------------------------
// THE MATCHING ENGINE
//
// This is plain, deterministic TypeScript. It compares fields on an employee
// record against the threshold written in a rule. There is no AI, no RAG and no
// probability anywhere in this file, and there must never be: the same data
// always produces the same answer, and every answer can be checked by hand.
//
// Three outcomes, and the difference between the last two is the whole point:
//   PASS    — the data we hold meets the requirement.
//   FAIL    — the data we hold does not meet it. Shown as "flagged for review".
//             It is a prompt for a human, never a verdict.
//   UNKNOWN — we do not hold the data the check needs. Shown as "needs review".
//             Missing data is NEVER treated as a failure.
// ---------------------------------------------------------------------------

import type {
  CheckResult,
  CheckStatus,
  Employee,
  Entity,
  EntityEvaluation,
  Rule,
  RuleEvaluation,
  StatusTally,
} from '@/types';
import { formatDate, monthsBetween, parseDate } from './dates';
import { credentialMatches, describeTargetRole, loose, roleMatches } from './normalize';

// --------------------------------------------------------------------------
// Step 1 — does this rule apply to this entity at all?
// --------------------------------------------------------------------------

export interface ApplicabilityDecision {
  applies: boolean;
  /** True when a filter field could not be evaluated because entity data is missing. */
  needsReview: boolean;
  reason: string;
}

export function ruleAppliesToEntity(entity: Entity, rule: Rule): ApplicabilityDecision {
  const filter = rule.appliesToEntityFilter ?? {};
  const matched: string[] = [];

  if (filter.entityType !== undefined) {
    if (loose(entity.entityType) !== loose(filter.entityType)) {
      return {
        applies: false,
        needsReview: false,
        reason: `Does not apply: this rule is for ${filter.entityType} entities, and ${entity.name} is a ${entity.entityType}.`,
      };
    }
    matched.push(`entity type is ${filter.entityType}`);
  }

  if (filter.category !== undefined) {
    const category = entity.characteristics?.category;
    if (!category) {
      return {
        applies: false,
        needsReview: true,
        reason: `Applicability needs review: this rule applies to the "${filter.category}" category, but no category is recorded for ${entity.name}.`,
      };
    }
    if (loose(category) !== loose(filter.category)) {
      return {
        applies: false,
        needsReview: false,
        reason: `Does not apply: this rule is for the "${filter.category}" category, and ${entity.name} is "${category}".`,
      };
    }
    matched.push(`category is ${filter.category}`);
  }

  if (filter.minAum !== undefined) {
    const aum = entity.characteristics?.aum;
    if (aum === null || aum === undefined || typeof aum !== 'number') {
      return {
        applies: false,
        needsReview: true,
        reason: `Applicability needs review: this rule applies above USD ${filter.minAum}m AUM, but no AUM figure is recorded for ${entity.name}.`,
      };
    }
    if (aum < filter.minAum) {
      return {
        applies: false,
        needsReview: false,
        reason: `Does not apply: this rule applies above USD ${filter.minAum}m AUM, and ${entity.name} manages USD ${aum}m.`,
      };
    }
    matched.push(`AUM of USD ${aum}m is above the USD ${filter.minAum}m threshold`);
  }

  if (filter.activity !== undefined) {
    const activities = entity.activities ?? [];
    const hit = activities.some((activity) => credentialMatches(filter.activity!, activity));
    if (!hit) {
      return {
        applies: false,
        needsReview: activities.length === 0,
        reason:
          activities.length === 0
            ? `Applicability needs review: this rule applies to entities carrying on "${filter.activity}", but no activities are recorded for ${entity.name}.`
            : `Does not apply: ${entity.name} does not carry on "${filter.activity}".`,
      };
    }
    matched.push(`carries on ${filter.activity}`);
  }

  if (filter.license !== undefined) {
    const licenses = entity.licenses ?? [];
    const hit = licenses.some((license) => credentialMatches(filter.license!, license));
    if (!hit) {
      return {
        applies: false,
        needsReview: licenses.length === 0,
        reason:
          licenses.length === 0
            ? `Applicability needs review: this rule applies to holders of "${filter.license}", but no licences are recorded for ${entity.name}.`
            : `Does not apply: ${entity.name} does not hold "${filter.license}".`,
      };
    }
    matched.push(`holds ${filter.license}`);
  }

  return {
    applies: true,
    needsReview: false,
    reason: matched.length
      ? `Applies because ${matched.join(', and ')}.`
      : 'Applies to every entity on the platform.',
  };
}

// --------------------------------------------------------------------------
// Step 2 — describe what a requirement asks for, in plain language.
// --------------------------------------------------------------------------

export function describeRequirement(rule: Rule): string {
  const { type, value, certificationName } = rule.requirement;
  switch (type) {
    case 'HAS_CERTIFICATION':
      return `Holds "${String(value)}"`;
    case 'CERTIFICATION_NOT_EXPIRED':
      return `Holds "${String(value)}", not expired`;
    case 'CERTIFICATION_RENEWED_WITHIN_MONTHS':
      return `"${certificationName ?? 'certification'}" renewed within the last ${Number(value)} months`;
    case 'MIN_EXPERIENCE_YEARS':
      return `At least ${Number(value)} years' relevant experience`;
    case 'HAS_QUALIFICATION': {
      const options = Array.isArray(value) ? value : [String(value)];
      return options.length === 1
        ? `Holds the qualification "${options[0]}"`
        : `Holds one of ${options.length} accepted qualifications`;
    }
    default:
      return `Unrecognised requirement type "${String(type)}"`;
  }
}

/** A one-line summary of a rule, used in notifications and the audit trail. */
export function summariseRule(rule: Rule): string {
  return `${describeTargetRole(rule.targetRole)} — ${describeRequirement(rule)}`;
}

// --------------------------------------------------------------------------
// Step 3 — check one employee against one rule.
// --------------------------------------------------------------------------

const MISSING_CERT_RECORDS = 'Certification records not provided';

export function checkEmployee(employee: Employee, rule: Rule, asOfDate: string): CheckResult {
  const base = {
    employeeId: employee.id,
    employeeName: employee.name,
    role: employee.role,
    ruleId: rule.id,
    expected: describeRequirement(rule),
  };

  const unknown = (actual: string, reason: string): CheckResult => ({
    ...base,
    status: 'UNKNOWN',
    actual,
    reason,
  });
  const fail = (actual: string, reason: string): CheckResult => ({
    ...base,
    status: 'FAIL',
    actual,
    reason,
  });
  const pass = (actual: string, reason: string): CheckResult => ({
    ...base,
    status: 'PASS',
    actual,
    reason,
  });

  const { type, value, certificationName } = rule.requirement;
  const asOf = parseDate(asOfDate);

  switch (type) {
    // ------------------------------------------------------------------
    case 'HAS_CERTIFICATION': {
      const required = String(value);
      const certs = employee.certifications;
      if (certs === null || certs === undefined) {
        return unknown(
          MISSING_CERT_RECORDS,
          `We hold no certification records for ${employee.name}, so we cannot tell whether they hold "${required}". Needs review — this is not a failure.`,
        );
      }
      const held = certs.find((cert) => cert?.name && credentialMatches(required, cert.name));
      if (held) {
        return pass(
          held.name,
          `${employee.name} holds "${held.name}", which meets the requirement.`,
        );
      }
      return fail(
        certs.length ? certs.map((cert) => cert.name).join('; ') : 'No certifications on record',
        `${employee.name} does not hold "${required}". Flagged for the compliance officer to review.`,
      );
    }

    // ------------------------------------------------------------------
    case 'CERTIFICATION_NOT_EXPIRED': {
      const required = String(value);
      const certs = employee.certifications;
      if (certs === null || certs === undefined) {
        return unknown(
          MISSING_CERT_RECORDS,
          `We hold no certification records for ${employee.name}, so the validity of "${required}" cannot be checked. Needs review — this is not a failure.`,
        );
      }
      const held = certs.find((cert) => cert?.name && credentialMatches(required, cert.name));
      if (!held) {
        return fail(
          certs.length ? certs.map((cert) => cert.name).join('; ') : 'No certifications on record',
          `${employee.name} does not hold "${required}" at all, so there is nothing valid on record. Flagged for review.`,
        );
      }
      const expiry = parseDate(held.expiryDate);
      if (!expiry) {
        return unknown(
          `${held.name} — expiry date not recorded`,
          `${employee.name} holds "${held.name}", but no expiry date is on record, so validity cannot be confirmed. Needs review — this is not a failure.`,
        );
      }
      if (!asOf) {
        return unknown(
          `${held.name} — expires ${formatDate(held.expiryDate)}`,
          'The evaluation date could not be read, so validity cannot be confirmed. Needs review.',
        );
      }
      if (expiry.getTime() < asOf.getTime()) {
        return fail(
          `${held.name} — expired ${formatDate(held.expiryDate)}`,
          `${employee.name}'s "${held.name}" expired on ${formatDate(held.expiryDate)}, before the evaluation date of ${formatDate(asOfDate)}. Flagged for review.`,
        );
      }
      return pass(
        `${held.name} — valid to ${formatDate(held.expiryDate)}`,
        `${employee.name}'s "${held.name}" is valid until ${formatDate(held.expiryDate)}.`,
      );
    }

    // ------------------------------------------------------------------
    case 'CERTIFICATION_RENEWED_WITHIN_MONTHS': {
      const months = Number(value);
      const required = certificationName ?? String(value);
      const certs = employee.certifications;
      if (certs === null || certs === undefined) {
        return unknown(
          MISSING_CERT_RECORDS,
          `We hold no training records for ${employee.name}, so we cannot tell when "${required}" was last completed. Needs review — this is not a failure.`,
        );
      }
      const held = certs.find((cert) => cert?.name && credentialMatches(required, cert.name));
      if (!held) {
        return fail(
          certs.length ? certs.map((cert) => cert.name).join('; ') : 'No certifications on record',
          `${employee.name} has no record of "${required}". Flagged for review.`,
        );
      }
      const issued = parseDate(held.issuedDate);
      if (!issued) {
        return unknown(
          `${held.name} — completion date not recorded`,
          `${employee.name} has "${held.name}" on record, but with no completion date, so the ${months}-month window cannot be checked. Needs review — this is not a failure.`,
        );
      }
      if (!asOf) {
        return unknown(
          `${held.name} — completed ${formatDate(held.issuedDate)}`,
          'The evaluation date could not be read, so the renewal window cannot be checked. Needs review.',
        );
      }
      const elapsed = monthsBetween(issued, asOf);
      if (elapsed > months) {
        return fail(
          `${held.name} — last completed ${formatDate(held.issuedDate)} (${elapsed} months ago)`,
          `${employee.name} last completed "${held.name}" ${elapsed} months ago, which is outside the ${months}-month window. Flagged for review.`,
        );
      }
      return pass(
        `${held.name} — last completed ${formatDate(held.issuedDate)} (${elapsed} months ago)`,
        `${employee.name} completed "${held.name}" ${elapsed} months ago, inside the ${months}-month window.`,
      );
    }

    // ------------------------------------------------------------------
    case 'MIN_EXPERIENCE_YEARS': {
      const required = Number(value);
      const actual = employee.experienceYears;
      if (actual === null || actual === undefined || typeof actual !== 'number' || Number.isNaN(actual)) {
        return unknown(
          'Years of experience not provided',
          `No experience figure is recorded for ${employee.name}, so the ${required}-year threshold cannot be checked. Needs review — this is not a failure.`,
        );
      }
      if (actual < required) {
        return fail(
          `${actual} years on record`,
          `${employee.name} has ${actual} years on record against a ${required}-year minimum — a shortfall of ${Number((required - actual).toFixed(2))} years. Flagged for review.`,
        );
      }
      return pass(
        `${actual} years on record`,
        `${employee.name} has ${actual} years on record, meeting the ${required}-year minimum.`,
      );
    }

    // ------------------------------------------------------------------
    case 'HAS_QUALIFICATION': {
      const accepted = Array.isArray(value) ? value.map(String) : [String(value)];
      const quals = employee.qualifications;
      if (quals === null || quals === undefined) {
        return unknown(
          'Qualifications not provided',
          `No qualifications are recorded for ${employee.name}, so this requirement cannot be checked. Needs review — this is not a failure.`,
        );
      }
      const held = quals.find((qual) =>
        accepted.some((option) => credentialMatches(option, qual)),
      );
      if (held) {
        return pass(held, `${employee.name} holds "${held}", which is an accepted qualification.`);
      }
      return fail(
        quals.length ? quals.join('; ') : 'No qualifications on record',
        `${employee.name} does not hold any of the accepted qualifications. Flagged for review.`,
      );
    }

    // ------------------------------------------------------------------
    default:
      // An unrecognised requirement type must never produce a failure.
      return unknown(
        'Not checked',
        `This rule uses requirement type "${String(type)}", which the engine does not recognise. Needs review by a person.`,
      );
  }
}

// --------------------------------------------------------------------------
// Step 4 — evaluate a whole entity.
// --------------------------------------------------------------------------

function emptyTally(): StatusTally {
  return { pass: 0, flagged: 0, needsReview: 0 };
}

function addToTally(tally: StatusTally, status: CheckStatus): void {
  if (status === 'PASS') tally.pass += 1;
  else if (status === 'FAIL') tally.flagged += 1;
  else tally.needsReview += 1;
}

/** FAIL beats UNKNOWN beats PASS, so the roster row shows the thing needing most attention. */
function worstOf(statuses: CheckStatus[]): CheckStatus | 'NOT_IN_SCOPE' {
  if (!statuses.length) return 'NOT_IN_SCOPE';
  if (statuses.includes('FAIL')) return 'FAIL';
  if (statuses.includes('UNKNOWN')) return 'UNKNOWN';
  return 'PASS';
}

export function evaluateEntity(
  entity: Entity,
  employees: Employee[],
  rules: Rule[],
  asOfDate: string,
): EntityEvaluation {
  const roster = employees.filter((employee) => employee.entityId === entity.id);
  const tally = emptyTally();

  const evaluations: RuleEvaluation[] = rules.map((rule) => {
    const decision = ruleAppliesToEntity(entity, rule);
    if (!decision.applies) {
      return {
        rule,
        applies: false,
        applicabilityNeedsReview: decision.needsReview,
        applicabilityReason: decision.reason,
        results: [],
        noTargetRoleHolders: false,
      };
    }
    const inScope = roster.filter((employee) => roleMatches(rule.targetRole, employee.role));
    const results = inScope.map((employee) => checkEmployee(employee, rule, asOfDate));
    results.forEach((result) => addToTally(tally, result.status));
    return {
      rule,
      applies: true,
      applicabilityNeedsReview: false,
      applicabilityReason: decision.reason,
      results,
      noTargetRoleHolders: inScope.length === 0,
    };
  });

  const perEmployee = roster.map((employee) => {
    const results = evaluations
      .flatMap((evaluation) => evaluation.results)
      .filter((result) => result.employeeId === employee.id);
    const employeeTally = emptyTally();
    results.forEach((result) => addToTally(employeeTally, result.status));
    return {
      employee,
      results,
      worstStatus: worstOf(results.map((result) => result.status)),
      tally: employeeTally,
    };
  });

  return { entity, employees: roster, evaluations, tally, perEmployee, asOfDate };
}

/** Evaluate every entity on the platform. */
export function evaluateAll(
  entities: Entity[],
  employees: Employee[],
  rules: Rule[],
  asOfDate: string,
): EntityEvaluation[] {
  return entities.map((entity) => evaluateEntity(entity, employees, rules, asOfDate));
}

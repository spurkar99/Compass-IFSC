// ---------------------------------------------------------------------------
// "What changed, and who is newly affected?"
//
// When a guideline is added or updated we run the engine twice — once on the
// rule book as it was, once as it now is — and compare the two results person
// by person. Only genuine movements are reported, so an officer is never shown
// a person who was already flagged yesterday as though they were new news.
//
// Like the engine, this is plain deterministic code.
// ---------------------------------------------------------------------------

import type {
  AffectedPerson,
  CheckResult,
  Employee,
  Entity,
  Notification,
  Rule,
} from '@/types';
import { evaluateAll, ruleAppliesToEntity } from './engine';

interface Snapshot {
  /** `${employeeId}::${ruleId}` -> the check result. */
  byKey: Map<string, { result: CheckResult; entityId: string }>;
}

function snapshot(
  entities: Entity[],
  employees: Employee[],
  rules: Rule[],
  asOfDate: string,
): Snapshot {
  const byKey = new Map<string, { result: CheckResult; entityId: string }>();
  for (const evaluation of evaluateAll(entities, employees, rules, asOfDate)) {
    for (const ruleEvaluation of evaluation.evaluations) {
      for (const result of ruleEvaluation.results) {
        byKey.set(`${result.employeeId}::${result.ruleId}`, {
          result,
          entityId: evaluation.entity.id,
        });
      }
    }
  }
  return { byKey };
}

function toAffectedPerson(
  result: CheckResult,
  previous: CheckResult | undefined,
): AffectedPerson {
  return {
    employeeId: result.employeeId,
    name: result.employeeName,
    role: result.role,
    status: result.status,
    expected: result.expected,
    actual: result.actual,
    reason: result.reason,
    previousStatus: previous ? previous.status : 'NOT_APPLICABLE',
  };
}

export interface ImpactOptions {
  entities: Entity[];
  employees: Employee[];
  /** The rule book before the change. */
  rulesBefore: Rule[];
  /** The rule book after the change. */
  rulesAfter: Rule[];
  /** The rule that was added or updated. */
  changedRule: Rule;
  /** The previous version of that rule, when this was an update. */
  previousRule?: Rule | null;
  changeType: 'RULE_ADDED' | 'RULE_UPDATED';
  asOfDate: string;
  /** Timestamp to stamp on the notifications, so results stay reproducible. */
  now: string;
}

/**
 * Compare before and after, and build one notification per entity that the
 * changed rule applies to — including entities with no gaps, so the officer
 * always learns that a new obligation landed.
 */
export function computeImpact(options: ImpactOptions): Notification[] {
  const {
    entities,
    employees,
    rulesBefore,
    rulesAfter,
    changedRule,
    previousRule,
    changeType,
    asOfDate,
    now,
  } = options;

  const before = snapshot(entities, employees, rulesBefore, asOfDate);
  const after = snapshot(entities, employees, rulesAfter, asOfDate);

  const notifications: Notification[] = [];

  for (const entity of entities) {
    const decision = ruleAppliesToEntity(entity, changedRule);
    if (!decision.applies) continue;

    const newlyFlagged: AffectedPerson[] = [];
    const newlyNeedsReview: AffectedPerson[] = [];
    const noLongerFlagged: AffectedPerson[] = [];

    // Movements into a flagged or needs-review state.
    for (const [key, entry] of after.byKey) {
      if (entry.entityId !== entity.id) continue;
      if (entry.result.ruleId !== changedRule.id) continue;
      const previous = before.byKey.get(key)?.result;
      if (entry.result.status === 'FAIL' && previous?.status !== 'FAIL') {
        newlyFlagged.push(toAffectedPerson(entry.result, previous));
      } else if (entry.result.status === 'UNKNOWN' && previous?.status !== 'UNKNOWN') {
        newlyNeedsReview.push(toAffectedPerson(entry.result, previous));
      }
    }

    // Movements out of a flagged state (good news worth reporting).
    for (const [key, entry] of before.byKey) {
      if (entry.entityId !== entity.id) continue;
      if (entry.result.ruleId !== changedRule.id) continue;
      if (entry.result.status !== 'FAIL') continue;
      const current = after.byKey.get(key)?.result;
      if (!current || current.status !== 'FAIL') {
        noLongerFlagged.push(toAffectedPerson(entry.result, current));
      }
    }

    const sortByName = (a: AffectedPerson, b: AffectedPerson) => a.name.localeCompare(b.name);

    notifications.push({
      id: `N-${entity.id}-${changedRule.id}-v${changedRule.version}`,
      createdAt: now,
      entityId: entity.id,
      entityName: entity.name,
      officer: entity.complianceOfficer,
      changeType,
      rule: changedRule,
      previousRule: previousRule
        ? {
            version: previousRule.version,
            requirement: previousRule.requirement,
            targetRole: previousRule.targetRole,
            citationRef: previousRule.citationRef,
          }
        : null,
      newlyFlagged: newlyFlagged.sort(sortByName),
      newlyNeedsReview: newlyNeedsReview.sort(sortByName),
      noLongerFlagged: noLongerFlagged.sort(sortByName),
      status: 'NEW',
      impactMemo: null,
    });
  }

  return notifications;
}

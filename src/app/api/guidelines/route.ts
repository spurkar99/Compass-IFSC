import { NextResponse } from 'next/server';
import type { EntityFilter, Requirement, RequirementType, Rule } from '@/types';
import { computeImpact } from '@/lib/impact';
import {
  addNotifications,
  getActiveRules,
  getAllRules,
  getAsOfDate,
  getEmployees,
  getEntities,
  getNotifications,
  nextRuleId,
  saveRules,
} from '@/lib/store';

const REQUIREMENT_TYPES: RequirementType[] = [
  'HAS_CERTIFICATION',
  'CERTIFICATION_NOT_EXPIRED',
  'CERTIFICATION_RENEWED_WITHIN_MONTHS',
  'MIN_EXPERIENCE_YEARS',
  'HAS_QUALIFICATION',
];

const NUMERIC_TYPES: RequirementType[] = [
  'CERTIFICATION_RENEWED_WITHIN_MONTHS',
  'MIN_EXPERIENCE_YEARS',
];

interface GuidelinePayload {
  mode?: 'ADD' | 'UPDATE';
  ruleId?: string;
  title?: string;
  citationRef?: string;
  citationText?: string;
  citationSource?: string;
  entityType?: string;
  category?: string;
  minAum?: string | number;
  targetRoles?: string[];
  allEmployees?: boolean;
  requirementType?: RequirementType;
  requirementValue?: string;
  certificationName?: string;
  effectiveDate?: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * THE DOOR.
 *
 * A guideline arrives here as a structured requirement — today from the form on
 * the Rules page, tomorrow from a real IFSCA feed. Either way it lands in the
 * same shape, is written to the rule book, and then the chain fires:
 *
 *   save the rule -> re-run the engine before and after -> find who NEWLY fails
 *   -> raise a notification to that entity's compliance officer.
 */
export async function POST(request: Request) {
  let payload: GuidelinePayload;
  try {
    payload = (await request.json()) as GuidelinePayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read the submitted form.' }, { status: 400 });
  }

  const mode = payload.mode === 'UPDATE' ? 'UPDATE' : 'ADD';
  const title = text(payload.title);
  const citationRef = text(payload.citationRef);
  const citationText = text(payload.citationText);
  const effectiveDate = text(payload.effectiveDate);
  const requirementType = payload.requirementType;
  const requirementValue = text(payload.requirementValue);

  // ---------------------------- validation ----------------------------
  const problems: string[] = [];
  if (!title) problems.push('Give the guideline a short title.');
  if (!citationRef) problems.push('A citation reference is required — every rule must be traceable to its source.');
  if (!citationText) problems.push('Paste the actual text of the requirement.');
  if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    problems.push('An effective date is required, as yyyy-mm-dd.');
  }
  if (!requirementType || !REQUIREMENT_TYPES.includes(requirementType)) {
    problems.push('Choose what the rule requires.');
  }
  if (!requirementValue) problems.push('Enter the value the requirement is measured against.');

  const allEmployees = payload.allEmployees === true;
  const targetRoles = (payload.targetRoles ?? []).map(text).filter(Boolean);
  if (!allEmployees && targetRoles.length === 0) {
    problems.push('Choose at least one role the rule targets, or tick "all employees".');
  }

  let numericValue: number | null = null;
  if (requirementType && NUMERIC_TYPES.includes(requirementType)) {
    numericValue = Number(requirementValue);
    if (Number.isNaN(numericValue) || numericValue <= 0) {
      problems.push('That requirement type needs a positive number.');
    }
    if (requirementType === 'CERTIFICATION_RENEWED_WITHIN_MONTHS' && !text(payload.certificationName)) {
      problems.push('Name the certification that has to be renewed.');
    }
  }

  if (problems.length > 0) {
    return NextResponse.json({ ok: false, error: problems.join(' '), problems }, { status: 400 });
  }

  // ---------------------------- build the rule ----------------------------
  const filter: EntityFilter = {};
  if (text(payload.entityType)) filter.entityType = text(payload.entityType);
  if (text(payload.category)) filter.category = text(payload.category);
  const minAum = Number(payload.minAum);
  if (payload.minAum !== undefined && payload.minAum !== '' && !Number.isNaN(minAum) && minAum > 0) {
    filter.minAum = minAum;
  }

  const requirement: Requirement = {
    type: requirementType!,
    value: numericValue !== null ? numericValue : requirementValue,
  };
  if (requirementType === 'CERTIFICATION_RENEWED_WITHIN_MONTHS') {
    requirement.certificationName = text(payload.certificationName);
  }

  const allRules = await getAllRules();
  const activeRules = await getActiveRules();
  const now = new Date().toISOString();

  let newRule: Rule;
  let previousRule: Rule | null = null;
  let persistedRules: Rule[];

  if (mode === 'UPDATE') {
    const ruleId = text(payload.ruleId);
    previousRule = activeRules.find((rule) => rule.id === ruleId) ?? null;
    if (!previousRule) {
      return NextResponse.json(
        { ok: false, error: `No rule currently in force with id "${ruleId}".` },
        { status: 400 },
      );
    }
    newRule = {
      id: previousRule.id,
      title,
      citationRef,
      citationText,
      citationSource: text(payload.citationSource) || previousRule.citationSource,
      appliesToEntityFilter: filter,
      targetRole: allEmployees ? '*' : targetRoles.length === 1 ? targetRoles[0] : targetRoles,
      requirement,
      version: previousRule.version + 1,
      effectiveDate,
      status: 'ACTIVE',
      source: 'GUIDELINE_FORM',
      createdAt: now,
      supersedesVersion: previousRule.version,
    };
    // The old version is kept in the file, marked superseded, for the audit trail.
    persistedRules = [
      ...allRules.map((rule) =>
        rule.id === newRule.id && (rule.status ?? 'ACTIVE') === 'ACTIVE'
          ? { ...rule, status: 'SUPERSEDED' as const }
          : rule,
      ),
      newRule,
    ];
  } else {
    newRule = {
      id: await nextRuleId(),
      title,
      citationRef,
      citationText,
      citationSource: text(payload.citationSource) || undefined,
      appliesToEntityFilter: filter,
      targetRole: allEmployees ? '*' : targetRoles.length === 1 ? targetRoles[0] : targetRoles,
      requirement,
      version: 1,
      effectiveDate,
      status: 'ACTIVE',
      source: 'GUIDELINE_FORM',
      createdAt: now,
    };
    persistedRules = [...allRules, newRule];
  }

  const rulesAfter =
    mode === 'UPDATE'
      ? activeRules.map((rule) => (rule.id === newRule.id ? newRule : rule))
      : [...activeRules, newRule];

  // ---------------------------- fire the chain ----------------------------
  const entities = await getEntities();
  const employees = await getEmployees();
  const asOfDate = await getAsOfDate();

  const notifications = computeImpact({
    entities,
    employees,
    rulesBefore: activeRules,
    rulesAfter,
    changedRule: newRule,
    previousRule,
    changeType: mode === 'UPDATE' ? 'RULE_UPDATED' : 'RULE_ADDED',
    asOfDate,
    now,
  });

  // Keep notification ids unique even if the same version is submitted twice.
  const existing = new Set((await getNotifications()).map((item) => item.id));
  const deduped = notifications.map((notification) => {
    let id = notification.id;
    let suffix = 2;
    while (existing.has(id)) {
      id = `${notification.id}-${suffix}`;
      suffix += 1;
    }
    existing.add(id);
    return { ...notification, id };
  });

  await saveRules(persistedRules);
  await addNotifications(deduped);

  return NextResponse.json({
    ok: true,
    rule: newRule,
    mode,
    notifications: deduped.map((notification) => ({
      id: notification.id,
      entityId: notification.entityId,
      entityName: notification.entityName,
      officer: notification.officer,
      newlyFlagged: notification.newlyFlagged.length,
      newlyNeedsReview: notification.newlyNeedsReview.length,
      noLongerFlagged: notification.noLongerFlagged.length,
      names: notification.newlyFlagged.map((person) => `${person.name} (${person.role})`),
    })),
  });
}

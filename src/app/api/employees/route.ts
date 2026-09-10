import { NextResponse } from 'next/server';
import type { Employee } from '@/types';
import { parseCertifications, parseQualifications } from '@/lib/csv';
import { checkEmployee, ruleAppliesToEntity } from '@/lib/engine';
import { roleMatches } from '@/lib/normalize';
import {
  getActiveRules,
  getAsOfDate,
  getEmployees,
  getEntity,
  nextEmployeeId,
  saveEmployees,
} from '@/lib/store';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Blank input means "not provided", which the engine reads as UNKNOWN. */
function blankToNull(value: unknown): string | null {
  const trimmed = text(value);
  return trimmed === '' ? null : trimmed;
}

/**
 * Add one person to an entity's roster, then report straight back how they land
 * against the rules already in force.
 *
 * Adding a person does not raise an officer notification — notifications are
 * reserved for guideline changes, so the alert list stays a record of policy
 * movements. Any gap for the new joiner shows on the roster immediately, and is
 * summarised in this response.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read the form.' }, { status: 400 });
  }

  const entityId = text(body.entityId);
  const name = text(body.name);
  const role = text(body.role);

  const problems: string[] = [];
  const entity = await getEntity(entityId);
  if (!entity) problems.push('Choose which company this person works for.');
  if (!name) problems.push('Enter the person’s name.');
  if (!role) problems.push('Enter their role, so the right rules can target them.');

  let experienceYears: number | null = null;
  const rawExperience = blankToNull(body.experienceYears);
  if (rawExperience !== null) {
    const parsed = Number(rawExperience);
    if (!Number.isFinite(parsed) || parsed < 0) {
      problems.push('Years of experience must be a number, or left blank.');
    } else {
      experienceYears = parsed;
    }
  }

  if (problems.length > 0) {
    return NextResponse.json({ ok: false, error: problems.join(' ') }, { status: 400 });
  }

  const employee: Employee = {
    id: text(body.employeeId) || (await nextEmployeeId(entityId)),
    entityId,
    name,
    role,
    qualifications: parseQualifications(blankToNull(body.qualifications)),
    certifications: parseCertifications(blankToNull(body.certifications)),
    experienceYears,
  };

  const existing = await getEmployees();
  if (existing.some((item) => item.id === employee.id)) {
    return NextResponse.json(
      { ok: false, error: `Employee id "${employee.id}" is already in use.` },
      { status: 400 },
    );
  }
  await saveEmployees([...existing, employee]);

  // Check the new joiner against the rules already in force.
  const rules = await getActiveRules();
  const asOfDate = await getAsOfDate();
  const results = rules
    .filter(
      (rule) =>
        ruleAppliesToEntity(entity!, rule).applies && roleMatches(rule.targetRole, employee.role),
    )
    .map((rule) => checkEmployee(employee, rule, asOfDate));

  const missing: string[] = [];
  if (employee.qualifications === null) missing.push('qualifications');
  if (employee.certifications === null) missing.push('certifications');
  if (employee.experienceYears === null) missing.push('years of experience');

  return NextResponse.json({
    ok: true,
    employee,
    missing,
    tally: {
      pass: results.filter((result) => result.status === 'PASS').length,
      flagged: results.filter((result) => result.status === 'FAIL').length,
      needsReview: results.filter((result) => result.status === 'UNKNOWN').length,
    },
  });
}

// ---------------------------------------------------------------------------
// Engine self-check.
//
// Every expectation below was worked out BY HAND from the seed files before
// this code was written, then compared against what the engine actually
// returns. Run it two ways:
//   - `npm run verify`          (from the terminal)
//   - open  /self-check         (in the running app)
//
// If a seed file is edited, the affected expectations here should be re-derived
// by hand. That is the point: this file is the human check on the machine.
// ---------------------------------------------------------------------------

import type { CheckStatus, DraftRule, Employee, Entity, Rule } from '@/types';
import { validateDraft } from './agents';
import { employeesFromCsv } from './csv';
import { checkEmployee, evaluateEntity, ruleAppliesToEntity } from './engine';
import { computeImpact } from './impact';
import { roleMatches } from './normalize';
import {
  getAsOfDate,
  getDemoGuideline,
  getSeedActiveRules,
  getSeedEmployees,
  getSeedEntities,
} from './store';

export interface CheckOutcome {
  id: string;
  group: string;
  description: string;
  expected: string;
  actual: string;
  ok: boolean;
}

export interface SelfCheckReport {
  outcomes: CheckOutcome[];
  passed: number;
  failed: number;
  asOfDate: string;
}

function expect(
  outcomes: CheckOutcome[],
  group: string,
  description: string,
  expected: unknown,
  actual: unknown,
): void {
  const expectedText = typeof expected === 'string' ? expected : JSON.stringify(expected);
  const actualText = typeof actual === 'string' ? actual : JSON.stringify(actual);
  outcomes.push({
    id: `${outcomes.length + 1}`,
    group,
    description,
    expected: expectedText,
    actual: actualText,
    ok: expectedText === actualText,
  });
}

function statusFor(
  employees: Employee[],
  entity: Entity,
  rules: Rule[],
  asOfDate: string,
  employeeId: string,
  ruleId: string,
): CheckStatus | 'NOT_CHECKED' {
  const evaluation = evaluateEntity(entity, employees, rules, asOfDate);
  const result = evaluation.evaluations
    .flatMap((ruleEvaluation) => ruleEvaluation.results)
    .find((item) => item.employeeId === employeeId && item.ruleId === ruleId);
  return result?.status ?? 'NOT_CHECKED';
}

export async function runSelfChecks(): Promise<SelfCheckReport> {
  const outcomes: CheckOutcome[] = [];
  const asOfDate = await getAsOfDate();
  // Read the pristine seed, so the result does not depend on what a demo run
  // has left in /data.
  const entities = await getSeedEntities();
  const employees = await getSeedEmployees();
  const rules = await getSeedActiveRules();
  const demoGuideline = (await getDemoGuideline()) as Rule | null;

  const acme = entities.find((entity) => entity.id === 'acme-fm')!;
  const northgate = entities.find((entity) => entity.id === 'northgate-fintech')!;

  // ---------------------------------------------------------------- group 1
  const G1 = '1. The "before" state at Acme';
  const acmeEval = evaluateEntity(acme, employees, rules, asOfDate);
  const acmeChecks = acmeEval.tally.pass + acmeEval.tally.flagged + acmeEval.tally.needsReview;
  expect(outcomes, G1, 'Acme has 48 people on its roster', 48, acmeEval.employees.length);
  expect(outcomes, G1, '23 of the 24 rules in force reach Acme (the FinTech-only rule does not)', 23, acmeEval.evaluations.filter((item) => item.applies).length);
  expect(outcomes, G1, 'That produces 131 individual checks', 131, acmeChecks);
  expect(
    outcomes,
    G1,
    'Of those, 125 are met, 2 are flagged and 4 need review',
    { pass: 125, flagged: 2, needsReview: 4 },
    acmeEval.tally,
  );
  expect(
    outcomes,
    G1,
    'Every key-personnel requirement is met, so the demo circular is unmistakably the thing that changes',
    'PASS,PASS,PASS,PASS,PASS,PASS,PASS,PASS',
    [
      ['E-101', 'R-001'], ['E-101', 'R-002'], ['E-101', 'R-005'], ['E-104', 'R-003'],
      ['E-104', 'R-010'], ['E-115', 'R-007'], ['E-130', 'R-017'], ['E-132', 'R-019'],
    ]
      .map(([employeeId, ruleId]) => statusFor(employees, acme, rules, asOfDate, employeeId, ruleId))
      .join(','),
  );
  expect(
    outcomes,
    G1,
    'The standing backlog is exactly two lapsed trainings: Marcus Lee (cyber) and Vikas Chandra (AML)',
    'Marcus Lee, Vikas Chandra',
    acmeEval.perEmployee
      .filter((row) => row.worstStatus === 'FAIL')
      .map((row) => row.employee.name)
      .sort()
      .join(', '),
  );
  expect(
    outcomes,
    G1,
    'And the only people needing review are the two recent joiners with no records',
    'Kabir Malhotra, Tanvi Sethi',
    acmeEval.perEmployee
      .filter((row) => row.worstStatus === 'UNKNOWN')
      .map((row) => row.employee.name)
      .sort()
      .join(', '),
  );
  expect(
    outcomes,
    G1,
    'All five Fund Managers meet the 3-year experience rule R-006',
    'PASS,PASS,PASS,PASS,PASS',
    ['E-102', 'E-103', 'E-106', 'E-107', 'E-108']
      .map((id) => statusFor(employees, acme, rules, asOfDate, id, 'R-006'))
      .join(','),
  );

  // ---------------------------------------------------------------- group 2
  const G2 = '2. Missing data is UNKNOWN, never a failure';
  const northgateEval = evaluateEntity(northgate, employees, rules, asOfDate);
  expect(
    outcomes,
    G2,
    'Aisha Bello has no certification records, so R-004 is UNKNOWN (not FAIL)',
    'UNKNOWN',
    statusFor(employees, northgate, rules, asOfDate, 'E-203', 'R-004'),
  );
  expect(
    outcomes,
    G2,
    'Vikram Shah last trained 29 months ago, so R-004 is FAIL — a real gap, unlike Aisha',
    'FAIL',
    statusFor(employees, northgate, rules, asOfDate, 'E-202', 'R-004'),
  );
  expect(
    outcomes,
    G2,
    'Northgate: 22 people, 12 of 24 rules reaching it, 53 checks',
    '22 people, 12 rules, 53 checks',
    `${northgateEval.employees.length} people, ${northgateEval.evaluations.filter((item) => item.applies).length} rules, ${northgateEval.tally.pass + northgateEval.tally.flagged + northgateEval.tally.needsReview} checks`,
  );
  expect(
    outcomes,
    G2,
    'Northgate tallies 48 met, 2 flagged, 3 needing review',
    { pass: 48, flagged: 2, needsReview: 3 },
    northgateEval.tally,
  );
  expect(
    outcomes,
    G2,
    'Aisha Bello, with no records at all, contributes 3 needs-review and NOT ONE failure',
    '0 flagged, 3 needs review',
    (() => {
      const row = northgateEval.perEmployee.find((item) => item.employee.id === 'E-203')!;
      return `${row.tally.flagged} flagged, ${row.tally.needsReview} needs review`;
    })(),
  );
  {
    const noExperience: Employee = {
      id: 'T-1', entityId: acme.id, name: 'Test Person', role: 'Principal Officer',
      qualifications: null, certifications: null, experienceYears: null,
    };
    const expRule = rules.find((rule) => rule.id === 'R-001')!;
    expect(
      outcomes,
      G2,
      'An employee with no experience figure is UNKNOWN on a minimum-experience rule',
      'UNKNOWN',
      checkEmployee(noExperience, expRule, asOfDate).status,
    );
    const qualRule = rules.find((rule) => rule.id === 'R-002')!;
    expect(
      outcomes,
      G2,
      'An employee with no qualifications recorded is UNKNOWN on a qualification rule',
      'UNKNOWN',
      checkEmployee(noExperience, qualRule, asOfDate).status,
    );
  }
  {
    // An empty list is different from a missing one: it means we DO know they
    // hold none, which is a genuine gap.
    const knownNone: Employee = {
      id: 'T-2', entityId: acme.id, name: 'Test Person', role: 'Principal Officer',
      qualifications: [], certifications: [], experienceYears: 20,
    };
    const certRule = rules.find((rule) => rule.id === 'R-005')!;
    expect(
      outcomes,
      G2,
      'An empty certification list (we know they hold none) is FAIL, not UNKNOWN',
      'FAIL',
      checkEmployee(knownNone, certRule, asOfDate).status,
    );
  }
  {
    // Certification held, but no expiry date on file.
    const noExpiry: Employee = {
      id: 'T-3', entityId: acme.id, name: 'Test Person', role: 'Principal Officer',
      qualifications: ['MBA (Finance)'], experienceYears: 8,
      certifications: [
        { name: 'NISM-Series-XIX-C: Alternative Investment Fund Managers Certification' },
      ],
    };
    const certRule = rules.find((rule) => rule.id === 'R-005')!;
    expect(
      outcomes,
      G2,
      'Certification held but expiry date missing is UNKNOWN, not FAIL',
      'UNKNOWN',
      checkEmployee(noExpiry, certRule, asOfDate).status,
    );
  }
  {
    const brokenRule = {
      ...rules[0],
      id: 'R-BROKEN',
      requirement: { type: 'SOMETHING_NEW' as never, value: 1 },
    } as Rule;
    expect(
      outcomes,
      G2,
      'A requirement type the engine does not recognise is UNKNOWN, never FAIL',
      'UNKNOWN',
      checkEmployee(employees[0], brokenRule, asOfDate).status,
    );
  }

  // ---------------------------------------------------------------- group 3
  const G3 = '3. Entity-conditional rules';
  expect(
    outcomes,
    G3,
    'R-001 (Fund Management Entities only) does not apply to Northgate, a FinTech Entity',
    false,
    ruleAppliesToEntity(northgate, rules.find((rule) => rule.id === 'R-001')!).applies,
  );
  expect(
    outcomes,
    G3,
    'R-003 applies to Acme because its USD 250m AUM is above the USD 100m threshold',
    true,
    ruleAppliesToEntity(acme, rules.find((rule) => rule.id === 'R-003')!).applies,
  );
  expect(
    outcomes,
    G3,
    'R-004 (AML training) applies to both entities — it has no entity filter',
    'true,true',
    [acme, northgate]
      .map((entity) => ruleAppliesToEntity(entity, rules.find((rule) => rule.id === 'R-004')!).applies)
      .join(','),
  );
  {
    const aumOnlyRule: Rule = {
      ...rules.find((rule) => rule.id === 'R-003')!,
      id: 'R-AUM-ONLY',
      appliesToEntityFilter: { minAum: 50 },
    };
    const decision = ruleAppliesToEntity(northgate, aumOnlyRule);
    expect(
      outcomes,
      G3,
      'A rule with an AUM threshold, against an entity with no AUM on file, is marked "applicability needs review"',
      'applies=false, needsReview=true',
      `applies=${decision.applies}, needsReview=${decision.needsReview}`,
    );
  }
  {
    const belowThreshold: Entity = {
      ...acme,
      characteristics: { ...acme.characteristics, aum: 40 },
    };
    expect(
      outcomes,
      G3,
      'The same USD 100m rule does not apply to an FME managing only USD 40m',
      false,
      ruleAppliesToEntity(belowThreshold, rules.find((rule) => rule.id === 'R-003')!).applies,
    );
  }

  // ---------------------------------------------------------------- group 4
  const G4 = '4. Messy role names still match';
  expect(outcomes, G4, '"PO" matches a rule targeting "Principal Officer"', true, roleMatches('Principal Officer', 'PO'));
  expect(outcomes, G4, '"principal  officer" (lowercase, double space) matches', true, roleMatches('Principal Officer', 'principal  officer'));
  expect(outcomes, G4, '"Portfolio Manager" is treated as a "Fund Manager"', true, roleMatches('Fund Manager', 'Portfolio Manager'));
  expect(outcomes, G4, '"Risk Analyst" does NOT match a Principal Officer rule', false, roleMatches('Principal Officer', 'Risk Analyst'));
  expect(outcomes, G4, 'targetRole "*" matches every role', true, roleMatches('*', 'Anything At All'));
  expect(outcomes, G4, 'A two-role rule matches the second role listed', true, roleMatches(['Principal Officer', 'Fund Manager'], 'Fund Manager'));

  // ---------------------------------------------------------------- group 5
  const G5 = '5. The demo: adding the new circular flags exactly two people';
  if (demoGuideline) {
    const newRule: Rule = {
      ...demoGuideline,
      status: 'ACTIVE',
      source: 'GUIDELINE_FORM',
    };
    const notifications = computeImpact({
      entities,
      employees,
      rulesBefore: rules,
      rulesAfter: [...rules, newRule],
      changedRule: newRule,
      previousRule: null,
      changeType: 'RULE_ADDED',
      asOfDate,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(outcomes, G5, 'Exactly one notification is raised (Acme only — the rule does not reach Northgate)', 1, notifications.length);
    const acmeNotification = notifications.find((item) => item.entityId === 'acme-fm');
    expect(outcomes, G5, 'It is addressed to Acme\'s compliance officer, Priya Raghavan', 'Priya Raghavan', acmeNotification?.officer.name ?? 'none');
    expect(outcomes, G5, 'Exactly 2 people are newly flagged', 2, acmeNotification?.newlyFlagged.length ?? -1);
    expect(
      outcomes,
      G5,
      'They are Rohit Desai and Sana Kapoor, both Fund Managers',
      'Rohit Desai (Fund Manager), Sana Kapoor (Fund Manager)',
      (acmeNotification?.newlyFlagged ?? []).map((person) => `${person.name} (${person.role})`).join(', '),
    );
    expect(
      outcomes,
      G5,
      'Arjun Mehta is NOT flagged — he already holds the newly-required certification',
      false,
      (acmeNotification?.newlyFlagged ?? []).some((person) => person.employeeId === 'E-101'),
    );
    expect(outcomes, G5, 'Nobody is newly moved into "needs review" by this change', 0, acmeNotification?.newlyNeedsReview.length ?? -1);
    expect(
      outcomes,
      G5,
      'The standing backlog is NOT reported as new — Marcus Lee and Vikas Chandra are absent from the alert',
      false,
      (acmeNotification?.newlyFlagged ?? [])
        .concat(acmeNotification?.newlyNeedsReview ?? [])
        .some((person) => ['E-119', 'E-135'].includes(person.employeeId)),
    );
    expect(
      outcomes,
      G5,
      'Two people are named out of a 48-person roster and 131 existing checks',
      '2 of 48',
      `${acmeNotification?.newlyFlagged.length ?? -1} of ${employees.filter((item) => item.entityId === 'acme-fm').length}`,
    );
    expect(
      outcomes,
      G5,
      'The notification carries the citation reference, so the officer sees the source',
      true,
      Boolean(acmeNotification?.rule.citationRef),
    );
    expect(
      outcomes,
      G5,
      'Adding the rule a second time raises no new flags — nobody moves twice',
      0,
      computeImpact({
        entities,
        employees,
        rulesBefore: [...rules, newRule],
        rulesAfter: [...rules, newRule],
        changedRule: newRule,
        previousRule: newRule,
        changeType: 'RULE_UPDATED',
        asOfDate,
        now: '2026-08-22T00:00:00.000Z',
      })[0]?.newlyFlagged.length ?? -1,
    );
  } else {
    expect(outcomes, G5, 'The demo circular file could be read', 'found', 'missing');
  }

  // ---------------------------------------------------------------- group 6
  const G6 = '6. Tightening an existing rule';
  {
    const original = rules.find((rule) => rule.id === 'R-003')!;
    const tightened: Rule = {
      ...original,
      version: 2,
      requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 12 },
      supersedesVersion: 1,
    };
    const after = rules.map((rule) => (rule.id === 'R-003' ? tightened : rule));
    const notifications = computeImpact({
      entities,
      employees,
      rulesBefore: rules,
      rulesAfter: after,
      changedRule: tightened,
      previousRule: original,
      changeType: 'RULE_UPDATED',
      asOfDate,
      now: '2026-08-22T00:00:00.000Z',
    });
    const acmeNotification = notifications.find((item) => item.entityId === 'acme-fm');
    expect(
      outcomes,
      G6,
      'Raising the Compliance Officer bar from 3 to 12 years newly flags Priya Raghavan (11 years)',
      'Priya Raghavan',
      (acmeNotification?.newlyFlagged ?? []).map((person) => person.name).join(', ') || 'nobody',
    );
    const relaxed: Rule = { ...tightened, version: 3, requirement: { type: 'MIN_EXPERIENCE_YEARS', value: 3 } };
    const relaxedNotifications = computeImpact({
      entities,
      employees,
      rulesBefore: after,
      rulesAfter: rules.map((rule) => (rule.id === 'R-003' ? relaxed : rule)),
      changedRule: relaxed,
      previousRule: tightened,
      changeType: 'RULE_UPDATED',
      asOfDate,
      now: '2026-08-22T00:00:00.000Z',
    });
    expect(
      outcomes,
      G6,
      'Relaxing it back reports Priya as no longer flagged',
      'Priya Raghavan',
      (relaxedNotifications.find((item) => item.entityId === 'acme-fm')?.noLongerFlagged ?? [])
        .map((person) => person.name)
        .join(', ') || 'nobody',
    );
  }

  // ---------------------------------------------------------------- group 7
  const G7 = '7. Messy CSV import never manufactures a failure';
  {
    const messy = [
      'Employee ID,Full Name,Designation,Education,Years of Experience,Certs',
      'E-901,Arjun Test,PO,MBA (Finance),14,AML/CFT Training Certificate|10/02/2026|',
      'E-902,"Surname, Given",portfolio manager,CFA Charter,not a number,',
      'E-903,Blank Fields,Fund Mgr,,,',
      'E-902,Duplicate Id,Analyst,B.A.,3,',
    ].join('\n');
    const imported = employeesFromCsv(messy, acme.id);

    expect(outcomes, G7, 'All 4 data rows are imported despite the mess', 4, imported.employees.length);
    expect(
      outcomes,
      G7,
      'Unreadable experience ("not a number") becomes "not provided", NOT zero years',
      'null',
      String(imported.employees[1].experienceYears),
    );
    expect(
      outcomes,
      G7,
      'It is reported as a warning rather than swallowed silently',
      true,
      imported.warnings.some((warning) => warning.includes('not a number')),
    );
    {
      const expRule = rules.find((rule) => rule.id === 'R-001')!;
      const asPrincipalOfficer = { ...imported.employees[1], role: 'Principal Officer' };
      expect(
        outcomes,
        G7,
        'That person is therefore UNKNOWN on a minimum-experience rule, not FAIL',
        'UNKNOWN',
        checkEmployee(asPrincipalOfficer, expRule, asOfDate).status,
      );
    }
    expect(
      outcomes,
      G7,
      'A blank certifications cell becomes null (not provided), never an empty list',
      'null',
      String(imported.employees[2].certifications),
    );
    expect(
      outcomes,
      G7,
      'A name containing a comma survives quoting',
      'Surname, Given',
      imported.employees[1].name,
    );
    expect(
      outcomes,
      G7,
      'A repeated employee id is given a new id rather than overwriting the first',
      true,
      imported.employees[3].id !== imported.employees[1].id,
    );
    expect(
      outcomes,
      G7,
      'The role "PO" from the spreadsheet is still matched by a Principal Officer rule',
      true,
      roleMatches('Principal Officer', imported.employees[0].role),
    );
    expect(
      outcomes,
      G7,
      'A dd/mm/yyyy date from a spreadsheet is understood',
      'PASS',
      checkEmployee(imported.employees[0], rules.find((rule) => rule.id === 'R-004')!, asOfDate).status,
    );
  }

  // ---------------------------------------------------------------- group 8
  const G8 = '8. Deterministic validation of what the intake agents propose';
  {
    const vocabulary = {
      entityTypes: Array.from(new Set(entities.map((entity) => entity.entityType))),
      certifications: Array.from(
        new Set(
          employees.flatMap((employee) => (employee.certifications ?? []).map((cert) => cert.name)),
        ),
      ),
      roles: Array.from(new Set(employees.map((employee) => employee.role))),
    };
    const good: DraftRule = {
      title: 'Risk Manager experience',
      citationRef: 'Circular F.No. IFSCA-FMD/2026/11',
      citationText: 'shall possess not less than seven years of experience',
      entityType: 'Fund Management Entity',
      category: '',
      minAum: '200',
      targetRoles: ['Risk Manager'],
      allEmployees: false,
      requirementType: 'MIN_EXPERIENCE_YEARS',
      requirementValue: '7',
      certificationName: '',
      effectiveDate: '2027-01-01',
    };
    const check = (patch: Partial<DraftRule>) => validateDraft({ ...good, ...patch }, vocabulary);

    expect(outcomes, G8, 'A well-formed proposal passes with no issues', 0, check({}).issues.length);
    {
      // The real mistake an agent made: USD 200 million written as raw currency.
      const out = check({ minAum: '200000000' });
      expect(
        outcomes,
        G8,
        'A raw currency AUM figure is caught as a BLOCKER and repaired to millions',
        'BLOCKER, repaired to 200',
        `${out.issues[0]?.severity}, repaired to ${out.issues[0]?.repairedTo}`,
      );
      expect(outcomes, G8, 'And the repaired value is what a human would be asked to sign off', '200', out.draft.minAum);
    }
    {
      // The other real mistake: a carve-out stuffed into an exact-match field.
      const out = check({
        entityType: 'Fund Management Entity (excluding an FME managing only accredited-investor schemes)',
      });
      expect(
        outcomes,
        G8,
        'A qualifier appended to entityType is caught, because that field is an exact match',
        'BLOCKER',
        out.issues[0]?.severity ?? 'none',
      );
      expect(outcomes, G8, 'The qualifier is stripped so the rule can still match', 'Fund Management Entity', out.draft.entityType);
    }
    expect(
      outcomes,
      G8,
      'An entity type nobody is registered under is a BLOCKER',
      'BLOCKER',
      check({ entityType: 'Banking Unit' }).issues[0]?.severity ?? 'none',
    );
    expect(
      outcomes,
      G8,
      'A word where a number belongs is a BLOCKER',
      'BLOCKER',
      check({ requirementValue: 'seven' }).issues[0]?.severity ?? 'none',
    );
    expect(
      outcomes,
      G8,
      'A rule with no citation reference cannot be filed',
      true,
      check({ citationRef: '' }).issues.some((issue) => issue.field === 'citationRef' && issue.severity === 'BLOCKER'),
    );
    expect(
      outcomes,
      G8,
      'A renewal rule that names no certification is a BLOCKER',
      true,
      check({
        requirementType: 'CERTIFICATION_RENEWED_WITHIN_MONTHS',
        requirementValue: '6',
        certificationName: '',
      }).issues.some((issue) => issue.field === 'certificationName'),
    );
    {
      // The regulator's wording vs the roster's wording — filing this unchanged
      // would flag everyone the rule targets.
      const out = check({
        requirementType: 'CERTIFICATION_RENEWED_WITHIN_MONTHS',
        requirementValue: '6',
        certificationName: 'anti-money laundering and counter-terrorist financing refresher programme',
        targetRoles: [],
        allEmployees: true,
      });
      expect(
        outcomes,
        G8,
        'A certification name that matches nothing on any roster is a BLOCKER, not a silent mass failure',
        true,
        out.issues.some((issue) => issue.severity === 'BLOCKER' && issue.field === 'certificationName'),
      );
    }
    expect(
      outcomes,
      G8,
      'The roster\'s own certification name passes the same check',
      0,
      check({
        requirementType: 'CERTIFICATION_RENEWED_WITHIN_MONTHS',
        requirementValue: '6',
        certificationName: 'AML/CFT Training Certificate',
        targetRoles: [],
        allEmployees: true,
      }).issues.length,
    );
    expect(
      outcomes,
      G8,
      'A role nobody holds is a WARNING, not a blocker — the rule may precede the hire',
      'WARNING',
      check({ targetRoles: ['Designated Director'] }).issues[0]?.severity ?? 'none',
    );
    expect(
      outcomes,
      G8,
      'No requirement type at all is a BLOCKER — nothing could be checked',
      true,
      check({ requirementType: '' }).issues.some((issue) => issue.field === 'requirementType'),
    );
  }

  const failed = outcomes.filter((outcome) => !outcome.ok).length;
  return { outcomes, passed: outcomes.length - failed, failed, asOfDate };
}

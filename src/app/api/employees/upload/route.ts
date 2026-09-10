import { NextResponse } from 'next/server';
import { employeesFromCsv } from '@/lib/csv';
import { evaluateEntity } from '@/lib/engine';
import {
  getActiveRules,
  getAsOfDate,
  getEmployees,
  getEntity,
  saveEmployees,
} from '@/lib/store';

/**
 * Replace one entity's roster from an uploaded CSV, then re-run the engine and
 * report what the new roster looks like. Other entities are left untouched.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const entityId = String(form.get('entityId') ?? '');
  const file = form.get('file');
  // 'replace' swaps the whole roster; 'merge' updates people whose employee id
  // matches and appends the rest, so a one-row file adds one person.
  const mode = String(form.get('mode') ?? 'replace') === 'merge' ? 'merge' : 'replace';

  const entity = await getEntity(entityId);
  if (!entity) {
    return NextResponse.json({ ok: false, error: `Unknown entity "${entityId}".` }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'No file was attached.' }, { status: 400 });
  }

  const text = await file.text();
  const parsed = employeesFromCsv(text, entityId);

  if (parsed.employees.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No usable rows were found in that file.',
        warnings: parsed.warnings,
      },
      { status: 400 },
    );
  }

  const existing = await getEmployees();
  const otherEntities = existing.filter((employee) => employee.entityId !== entityId);
  const currentRoster = existing.filter((employee) => employee.entityId === entityId);

  let roster = parsed.employees;
  let updated = 0;
  let added = 0;
  if (mode === 'merge') {
    const incoming = new Map(parsed.employees.map((employee) => [employee.id, employee]));
    roster = currentRoster.map((employee) => {
      const replacement = incoming.get(employee.id);
      if (replacement) {
        incoming.delete(employee.id);
        updated += 1;
        return replacement;
      }
      return employee;
    });
    added = incoming.size;
    roster = [...roster, ...incoming.values()];
  }

  await saveEmployees([...otherEntities, ...roster]);

  const rules = await getActiveRules();
  const asOfDate = await getAsOfDate();
  const evaluation = evaluateEntity(entity, roster, rules, asOfDate);

  return NextResponse.json({
    ok: true,
    mode,
    imported: parsed.employees.length,
    rowsRead: parsed.rowsRead,
    replaced: mode === 'replace' ? currentRoster.length : 0,
    updated,
    added,
    rosterSize: roster.length,
    warnings: parsed.warnings,
    missingDataNotes: parsed.missingDataNotes,
    tally: evaluation.tally,
  });
}

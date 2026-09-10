import { NextResponse } from 'next/server';
import type { Entity } from '@/types';
import { getEntities, nextEntityId, saveEntities } from '@/lib/store';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Split a textarea or semicolon list into clean lines. */
function list(value: unknown): string[] {
  return text(value)
    .split(/[\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Register a company. It arrives through the same structured door as everything
 * else, so the rules already in force are applied to it the moment it exists.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read the form.' }, { status: 400 });
  }

  const name = text(body.name);
  const entityType = text(body.entityType);
  const officerName = text(body.officerName);
  const officerEmail = text(body.officerEmail);

  const problems: string[] = [];
  if (!name) problems.push('Enter the company name.');
  if (!entityType) problems.push('Enter the entity type — rules often apply based on it.');
  if (!officerName) problems.push('Name the compliance officer who should receive notifications.');
  if (!officerEmail || !officerEmail.includes('@')) {
    problems.push('Give the compliance officer’s email address.');
  }

  let aum: number | null = null;
  const rawAum = text(body.aum);
  if (rawAum !== '') {
    const parsed = Number(rawAum);
    if (!Number.isFinite(parsed) || parsed < 0) {
      problems.push('AUM must be a number in USD millions, or left blank.');
    } else {
      aum = parsed;
    }
  }

  if (problems.length > 0) {
    return NextResponse.json({ ok: false, error: problems.join(' ') }, { status: 400 });
  }

  const existing = await getEntities();
  if (existing.some((entity) => entity.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { ok: false, error: `A company called "${name}" is already registered.` },
      { status: 400 },
    );
  }

  const entity: Entity = {
    id: await nextEntityId(name),
    name,
    entityType,
    activities: list(body.activities),
    licenses: list(body.licenses),
    characteristics: {
      category: text(body.category) || undefined,
      // Left blank on purpose stays absent: a rule with an AUM threshold will
      // then report "applicability needs review" rather than quietly skipping.
      aum,
      aumCurrency: aum === null ? undefined : 'USD million',
      jurisdiction: text(body.jurisdiction) || undefined,
    },
    complianceOfficer: { name: officerName, email: officerEmail },
  };

  await saveEntities([...existing, entity]);
  return NextResponse.json({ ok: true, entity });
}

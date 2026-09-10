// ---------------------------------------------------------------------------
// Generate additional synthetic employee records with Claude on AWS Bedrock.
//
//   npm run synth -- --entity acme-fm --count 12
//   npm run synth -- --entity northgate-fintech --count 8 --dry-run
//
// Why this exists: the brief asks for sample datasets generated with the AI/cloud
// credits, and for the synthetic parts to be disclosed. This script is that,
// explicitly. Records it writes are tagged so they can always be told apart from
// the hand-designed seed.
//
// It appends to data/employees.json. It never touches data/seed/, so
// `npm run reset` still restores the reproducible demo.
// ---------------------------------------------------------------------------

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Employee, Entity } from '../src/types';

function arg(name: string, fallback = ''): string {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
const dryRun = process.argv.includes('--dry-run');

async function loadEnvLocal(): Promise<void> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim();
      if (value && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // no .env.local — the credential chain may still work
  }
}

function extractJson(text: string): unknown | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  for (const candidate of [fenced?.[1], text]) {
    if (!candidate) continue;
    const start = candidate.indexOf('[');
    const end = candidate.lastIndexOf(']');
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      /* try the next */
    }
  }
  return null;
}

async function main() {
  await loadEnvLocal();

  const entityId = arg('entity', 'acme-fm');
  const count = Math.min(Math.max(Number(arg('count', '10')) || 10, 1), 40);

  const dataDir = path.join(process.cwd(), 'data');
  const entities = JSON.parse(
    await fs.readFile(path.join(dataDir, 'entities.json'), 'utf8'),
  ) as Entity[];
  const employees = JSON.parse(
    await fs.readFile(path.join(dataDir, 'employees.json'), 'utf8'),
  ) as Employee[];

  const entity = entities.find((item) => item.id === entityId);
  if (!entity) {
    console.error(`Unknown entity "${entityId}". Known: ${entities.map((e) => e.id).join(', ')}`);
    process.exit(1);
  }

  const roster = employees.filter((item) => item.entityId === entityId);
  const knownCerts = Array.from(
    new Set(
      employees.flatMap((item) => (item.certifications ?? []).map((cert) => cert.name)),
    ),
  );
  const knownRoles = Array.from(new Set(roster.map((item) => item.role)));
  const existingNames = new Set(employees.map((item) => item.name.toLowerCase()));

  const system = `You generate synthetic employee records for a compliance prototype. The people
are fictional. Produce realistic, varied records for a financial-services firm in GIFT IFSC,
India — a mix of Indian and international names, plausible roles, qualifications and dates.

HARD RULES
- Output a JSON array only. No prose, no code fence commentary.
- Use ONLY these certification names, spelled exactly: ${knownCerts.join(' | ')}
- Prefer these role titles, spelled exactly: ${knownRoles.join(' | ')}
- Dates are ISO YYYY-MM-DD. Today is 2026-08-22. Training certificates
  ("AML/CFT Training Certificate", "Cyber Security Awareness Training") carry issuedDate only
  and should normally be within the last 12 months.
- Give roughly one in six people a realistic data gap: either a lapsed training date (15-30
  months old), or use null for qualifications / certifications / experienceYears to represent
  a recent joiner whose records have not arrived. Use null, never an empty array, for "not
  supplied".
- Do not reuse any of these existing names: ${roster.map((r) => r.name).join(', ')}

Each element:
{ "name": "...", "role": "...", "qualifications": ["..."] | null,
  "experienceYears": 7 | null,
  "certifications": [ { "name": "...", "issuedDate": "YYYY-MM-DD", "expiryDate": "YYYY-MM-DD" } ] | null }
Omit expiryDate for training certificates.`;

  console.log(`Generating ${count} synthetic records for ${entity.name} (${entity.entityType})…`);

  const { AnthropicBedrockMantle } = await import('@anthropic-ai/bedrock-sdk');
  const client = new AnthropicBedrockMantle({
    awsRegion: process.env.AWS_REGION?.trim() || 'us-east-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          awsAccessKey: process.env.AWS_ACCESS_KEY_ID.trim(),
          awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim(),
        }
      : {}),
  });

  let reply: string;
  try {
    const response = await client.messages.create({
      model: process.env.BEDROCK_MODEL_ID?.trim() || 'anthropic.claude-opus-5',
      max_tokens: 8000,
      system,
      messages: [
        {
          role: 'user',
          content: `Generate ${count} records for a ${entity.entityType} called ${entity.name}.`,
        },
      ],
      output_config: { effort: 'low' },
    });
    reply = response.content
      .filter((block): block is { type: 'text'; text: string; citations: null } => block.type === 'text')
      .map((block) => block.text)
      .join('\n');
  } catch (error) {
    console.error(`Bedrock call failed: ${(error as Error).message}`);
    console.error('Run `npm run check-ai` to test your credentials.');
    process.exit(1);
  }

  const parsed = extractJson(reply);
  if (!Array.isArray(parsed)) {
    console.error('Could not read a JSON array from the response.');
    process.exit(1);
  }

  // Work out the next free id in this entity's numbering scheme.
  const numbered = roster
    .map((item) => /^([A-Za-z]+-)(\d+)$/.exec(item.id))
    .filter((match): match is RegExpExecArray => match !== null);
  const prefix = numbered[0]?.[1] ?? 'E-';
  const width = numbered[0]?.[2].length ?? 3;
  let next = numbered.length ? Math.max(...numbered.map((m) => Number(m[2]))) + 1 : 1;

  const generated: Employee[] = [];
  for (const raw of parsed) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const name = typeof item.name === 'string' ? item.name.trim() : '';
    const role = typeof item.role === 'string' ? item.role.trim() : '';
    if (!name || !role || existingNames.has(name.toLowerCase())) continue;
    existingNames.add(name.toLowerCase());
    generated.push({
      id: `${prefix}${String(next++).padStart(width, '0')}`,
      entityId,
      name,
      role,
      qualifications: Array.isArray(item.qualifications)
        ? (item.qualifications as string[]).map(String)
        : null,
      experienceYears: typeof item.experienceYears === 'number' ? item.experienceYears : null,
      certifications: Array.isArray(item.certifications)
        ? (item.certifications as Employee['certifications'])
        : null,
      // Tag it, so a synthetic record is always distinguishable from the seed.
      _note: 'Synthetic record generated by Claude on AWS Bedrock via `npm run synth`.',
    });
  }

  console.log(`\nParsed ${generated.length} usable records:\n`);
  generated.forEach((item) => {
    const gaps = [
      item.qualifications === null ? 'quals' : null,
      item.certifications === null ? 'certs' : null,
      item.experienceYears === null ? 'experience' : null,
    ].filter(Boolean);
    console.log(
      `  ${item.id}  ${item.name.padEnd(24)} ${item.role.padEnd(30)} ` +
        `${item.experienceYears === null ? ' n/a' : String(item.experienceYears).padStart(3) + 'y'}` +
        `${gaps.length ? `  [not supplied: ${gaps.join(', ')}]` : ''}`,
    );
  });

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }
  if (generated.length === 0) {
    console.log('\nNothing usable to write.');
    return;
  }

  await fs.writeFile(
    path.join(dataDir, 'employees.json'),
    `${JSON.stringify([...employees, ...generated], null, 2)}\n`,
    'utf8',
  );
  console.log(
    `\nAppended ${generated.length} records to data/employees.json (${employees.length} -> ${employees.length + generated.length}).`,
  );
  console.log('data/seed/ is untouched, so `npm run reset` still restores the demo.');
}

main();

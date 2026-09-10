// ---------------------------------------------------------------------------
// The data "door".
//
// Everything that enters or leaves the system goes through these functions.
// They read and write JSON — on a laptop that means files in /data, on AWS it
// means objects in an S3 bucket. Which one is decided by storage.ts, and
// nothing above this layer knows the difference. To move to a real database or
// a live IFSCA feed later, you replace the bodies of these functions and
// nothing else in the app has to change.
// ---------------------------------------------------------------------------

import type {
  AppConfig,
  Employee,
  Entity,
  Notification,
  Rule,
} from '@/types';
import { todayIso } from './dates';
import { readRaw, writeRaw, storageDescription, storageMode } from './storage';
import {
  SEED_BY_FILE,
  STATIC_BY_FILE,
  SEED_ENTITIES,
  SEED_EMPLOYEES,
  SEED_RULES,
  BUNDLED_CONFIG,
  BUNDLED_DEMO_GUIDELINE,
} from './bundled';

export { storageDescription, storageMode };

/**
 * Read a state file.
 *
 * If the backing store has nothing for it — a fresh S3 bucket, or a deleted
 * file — we fall back to the seed compiled into the build rather than to an
 * empty list. That is what makes a brand-new deployment come up already
 * showing the demo instead of an empty dashboard.
 */
async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const raw = await readRaw(fileName);
  if (raw !== null) {
    try {
      return JSON.parse(raw) as T;
    } catch {
      console.warn(`[store] ${fileName} is not valid JSON; using the bundled copy`);
    }
  }
  const seeded = SEED_BY_FILE[fileName] ?? STATIC_BY_FILE[fileName];
  return (seeded === undefined ? fallback : (seeded as T));
}

async function writeJson(fileName: string, value: unknown): Promise<void> {
  await writeRaw(fileName, `${JSON.stringify(value, null, 2)}\n`);
}

// ------------------------------- reads -------------------------------------

export async function getConfig(): Promise<AppConfig> {
  const config = await readJson<Partial<AppConfig>>('config.json', BUNDLED_CONFIG);
  return {
    asOfDate: config.asOfDate ?? null,
    productName: config.productName ?? 'Compass IFSC',
  };
}

/** The date every date-based check is measured against. */
export async function getAsOfDate(): Promise<string> {
  const { asOfDate } = await getConfig();
  return asOfDate ?? todayIso();
}

export async function getEntities(): Promise<Entity[]> {
  return readJson<Entity[]>('entities.json', []);
}

export async function getEntity(entityId: string): Promise<Entity | undefined> {
  const entities = await getEntities();
  return entities.find((entity) => entity.id === entityId);
}

export async function getEmployees(): Promise<Employee[]> {
  return readJson<Employee[]>('employees.json', []);
}

export async function getEmployeesForEntity(entityId: string): Promise<Employee[]> {
  const employees = await getEmployees();
  return employees.filter((employee) => employee.entityId === entityId);
}

/** All rules, including superseded versions (kept for the audit trail). */
export async function getAllRules(): Promise<Rule[]> {
  return readJson<Rule[]>('rules.json', []);
}

/** Only the rules currently in force. */
export async function getActiveRules(): Promise<Rule[]> {
  const rules = await getAllRules();
  return rules.filter((rule) => (rule.status ?? 'ACTIVE') === 'ACTIVE');
}

export async function getNotifications(): Promise<Notification[]> {
  const notifications = await readJson<Notification[]>('notifications.json', []);
  return [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The pre-filled circular used by the "Load demo circular" button. */
export async function getDemoGuideline(): Promise<Partial<Rule> | null> {
  return readJson<Partial<Rule> | null>('demo-guideline.json', BUNDLED_DEMO_GUIDELINE);
}

// ------------------------------- writes ------------------------------------

export async function saveEmployees(employees: Employee[]): Promise<void> {
  await writeJson('employees.json', employees);
}

export async function saveEntities(entities: Entity[]): Promise<void> {
  await writeJson('entities.json', entities);
}

export async function saveRules(rules: Rule[]): Promise<void> {
  await writeJson('rules.json', rules);
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  await writeJson('notifications.json', notifications);
}

export async function addNotifications(added: Notification[]): Promise<void> {
  const existing = await readJson<Notification[]>('notifications.json', []);
  await saveNotifications([...existing, ...added]);
}

export async function updateNotification(
  id: string,
  patch: Partial<Notification>,
): Promise<Notification | null> {
  const notifications = await readJson<Notification[]>('notifications.json', []);
  const index = notifications.findIndex((notification) => notification.id === id);
  if (index === -1) return null;
  const updated = { ...notifications[index], ...patch };
  notifications[index] = updated;
  await saveNotifications(notifications);
  return updated;
}

/**
 * Next free employee id for an entity, following whatever numbering it already
 * uses (E-101, E-102 -> E-106). Falls back to a generic id for a new entity.
 */
export async function nextEmployeeId(entityId: string): Promise<string> {
  const roster = await getEmployeesForEntity(entityId);
  const parsed = roster
    .map((employee) => /^([A-Za-z]+-)(\d+)$/.exec(employee.id))
    .filter((match): match is RegExpExecArray => match !== null);
  if (parsed.length === 0) {
    return `E-${String(roster.length + 1).padStart(3, '0')}`;
  }
  const prefix = parsed[0][1];
  const width = parsed[0][2].length;
  const highest = Math.max(...parsed.map((match) => Number(match[2])));
  return `${prefix}${String(highest + 1).padStart(width, '0')}`;
}

/** Turn a company name into a usable, unique id, e.g. "acme-fund-management". */
export async function nextEntityId(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .split('-')
      .slice(0, 4)
      .join('-') || 'entity';
  const taken = new Set((await getEntities()).map((entity) => entity.id));
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

/** Next free rule id, e.g. "R-006". */
export async function nextRuleId(): Promise<string> {
  const rules = await getAllRules();
  const numbers = rules
    .map((rule) => Number(/^R-(\d+)$/.exec(rule.id)?.[1] ?? Number.NaN))
    .filter((value) => !Number.isNaN(value));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `R-${String(next).padStart(3, '0')}`;
}

// ------------------------------- seed reads --------------------------------
//
// The engine self-check must verify the engine against data it knows by hand,
// not against whatever state a demo has been left in. So it uses the pristine
// seed compiled into the build rather than the live state.

export async function getSeedEntities(): Promise<Entity[]> {
  return SEED_ENTITIES;
}

export async function getSeedEmployees(): Promise<Employee[]> {
  return SEED_EMPLOYEES;
}

export async function getSeedActiveRules(): Promise<Rule[]> {
  return SEED_RULES.filter((rule) => (rule.status ?? 'ACTIVE') === 'ACTIVE');
}

// ------------------------------- reset -------------------------------------

/** Restore /data from /data/seed so the demo can be run again from the top. */
export async function resetToSeed(): Promise<string[]> {
  const restored: string[] = [];
  for (const [file, contents] of Object.entries(SEED_BY_FILE)) {
    try {
      await writeJson(file, contents);
      restored.push(file);
    } catch (error) {
      console.warn(`[store] could not restore ${file}: ${String(error)}`);
    }
  }
  return restored;
}

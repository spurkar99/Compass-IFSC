// ---------------------------------------------------------------------------
// The seed data, compiled into the build.
//
// Why imports rather than reading /data at runtime: on AWS Amplify the app
// runs on Lambda, and files sitting next to the source are not guaranteed to
// be in the deployed bundle. Importing them makes them part of the compiled
// JavaScript, so they are always there — on a laptop, on Lambda, anywhere.
//
// These are the PRISTINE seed files. They serve three purposes:
//   1. The starting state for a fresh S3 bucket.
//   2. What "Reset demo" restores.
//   3. What the engine self-check measures itself against, so the check never
//      depends on whatever state a demo has been left in.
// ---------------------------------------------------------------------------

import type { AppConfig, Employee, Entity, Notification, Rule } from '@/types';

import seedEntitiesJson from '../../data/seed/entities.json';
import seedEmployeesJson from '../../data/seed/employees.json';
import seedRulesJson from '../../data/seed/rules.json';
import seedNotificationsJson from '../../data/seed/notifications.json';
import configJson from '../../data/config.json';
import demoGuidelineJson from '../../data/demo-guideline.json';

export const SEED_ENTITIES = seedEntitiesJson as unknown as Entity[];
export const SEED_EMPLOYEES = seedEmployeesJson as unknown as Employee[];
export const SEED_RULES = seedRulesJson as unknown as Rule[];
export const SEED_NOTIFICATIONS = seedNotificationsJson as unknown as Notification[];

export const BUNDLED_CONFIG = configJson as unknown as Partial<AppConfig>;
export const BUNDLED_DEMO_GUIDELINE = demoGuidelineJson as unknown as Partial<Rule> | null;

/** The four files that can be written to, and their starting contents. */
export const SEED_BY_FILE: Record<string, unknown> = {
  'entities.json': SEED_ENTITIES,
  'employees.json': SEED_EMPLOYEES,
  'rules.json': SEED_RULES,
  'notifications.json': SEED_NOTIFICATIONS,
};

/** Read-only files that are never written, only ever read. */
export const STATIC_BY_FILE: Record<string, unknown> = {
  'config.json': BUNDLED_CONFIG,
  'demo-guideline.json': BUNDLED_DEMO_GUIDELINE,
};

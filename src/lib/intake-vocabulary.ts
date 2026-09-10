import type { KnownVocabulary } from './agents';
import { getEmployees, getEntities } from './store';

/**
 * What this system can actually match against. The agents and the validator are
 * both told, so a mismatch between the regulator's wording and the roster's
 * wording surfaces at sign-off rather than after filing.
 */
export async function currentVocabulary(): Promise<KnownVocabulary> {
  const entities = await getEntities();
  const employees = await getEmployees();
  return {
    entityTypes: Array.from(new Set(entities.map((entity) => entity.entityType))),
    certifications: Array.from(
      new Set(
        employees.flatMap((employee) => (employee.certifications ?? []).map((cert) => cert.name)),
      ),
    ),
    roles: Array.from(new Set(employees.map((employee) => employee.role))),
  };
}

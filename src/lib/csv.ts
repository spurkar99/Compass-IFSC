// ---------------------------------------------------------------------------
// CSV import for employee rosters.
//
// Real spreadsheets are messy, so this is written to bend rather than break:
//   - column headings are matched loosely ("Employee ID", "employee_id", "id")
//   - quoted fields, commas inside quotes and stray whitespace are handled
//   - a BLANK cell becomes `null` (data not provided -> UNKNOWN downstream),
//     never an empty list, because "we weren't told" and "they have none" are
//     different facts
//   - a bad row is reported as a warning and skipped; it never aborts the import
// ---------------------------------------------------------------------------

import type { Certification, Employee } from '@/types';
import { loose } from './normalize';

/** Split CSV text into rows of cells, honouring quotes and embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const input = text.replace(/^﻿/, ''); // strip a spreadsheet byte-order mark

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop rows that are entirely blank.
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

/** Accepted spellings for each column we understand. */
const COLUMNS: Record<string, string[]> = {
  id: ['employeeid', 'employee id', 'id', 'staff id', 'emp id', 'employee_id'],
  name: ['name', 'full name', 'employee name', 'employee'],
  role: ['role', 'designation', 'job title', 'title', 'position'],
  qualifications: ['qualifications', 'qualification', 'quals', 'education', 'degrees'],
  experienceYears: [
    'experienceyears',
    'experience years',
    'experience',
    'years of experience',
    'yrs experience',
    'experience_years',
  ],
  certifications: ['certifications', 'certification', 'certs', 'certificates'],
};

function headerIndex(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((header, index) => {
    const key = loose(header).replace(/_/g, ' ');
    for (const [field, spellings] of Object.entries(COLUMNS)) {
      if (map[field] !== undefined) continue;
      if (spellings.some((spelling) => loose(spelling).replace(/_/g, ' ') === key)) {
        map[field] = index;
      }
    }
  });
  return map;
}

/** Blank cell -> null (not provided). Otherwise the trimmed text. */
function cellOrNull(cells: string[], index: number | undefined): string | null {
  if (index === undefined) return null;
  const value = (cells[index] ?? '').trim();
  return value === '' ? null : value;
}

/**
 * Certifications are written as:
 *   Name|issued|expiry ; Another Name|issued|expiry
 * Issued and expiry are optional — leave them blank if you do not have them.
 */
export function parseCertifications(raw: string | null): Certification[] | null {
  if (raw === null) return null;
  const entries = raw
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  if (entries.length === 0) return null;
  return entries.map((entry) => {
    const [name, issued, expiry] = entry.split('|').map((part) => (part ?? '').trim());
    const cert: Certification = { name: name || 'Unnamed certification' };
    if (issued) cert.issuedDate = issued;
    if (expiry) cert.expiryDate = expiry;
    return cert;
  });
}

export function parseQualifications(raw: string | null): string[] | null {
  if (raw === null) return null;
  const values = raw
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return values.length ? values : null;
}

export interface CsvImportResult {
  employees: Employee[];
  warnings: string[];
  /** Fields that came in blank, so the officer knows what will show as UNKNOWN. */
  missingDataNotes: string[];
  rowsRead: number;
}

export function employeesFromCsv(text: string, entityId: string): CsvImportResult {
  const rows = parseCsv(text);
  const warnings: string[] = [];
  const missingDataNotes: string[] = [];
  const employees: Employee[] = [];

  if (rows.length === 0) {
    return { employees, warnings: ['The file was empty.'], missingDataNotes, rowsRead: 0 };
  }

  const map = headerIndex(rows[0]);
  if (map.name === undefined) {
    return {
      employees,
      warnings: [
        `Could not find a "name" column. Found: ${rows[0].join(', ')}. Download the template for the expected headings.`,
      ],
      missingDataNotes,
      rowsRead: 0,
    };
  }
  if (map.role === undefined) {
    warnings.push('No "role" column found — every row will be imported with the role "Unspecified", so no role-specific rule will target them.');
  }

  const dataRows = rows.slice(1);
  const seenIds = new Set<string>();

  dataRows.forEach((cells, rowIndex) => {
    const lineNumber = rowIndex + 2; // +1 for the header, +1 for 1-based counting
    const name = cellOrNull(cells, map.name);
    if (!name) {
      warnings.push(`Row ${lineNumber} skipped: no name.`);
      return;
    }

    let id = cellOrNull(cells, map.id) ?? `CSV-${String(rowIndex + 1).padStart(3, '0')}`;
    if (seenIds.has(id)) {
      warnings.push(`Row ${lineNumber}: employee id "${id}" appears more than once — the later row was given a new id.`);
      id = `${id}-${rowIndex + 1}`;
    }
    seenIds.add(id);

    const role = cellOrNull(cells, map.role) ?? 'Unspecified';
    const rawExperience = cellOrNull(cells, map.experienceYears);
    let experienceYears: number | null = null;
    if (rawExperience !== null) {
      // Tolerate "12 years" or "8.5 yrs", but text with no digits at all must
      // stay `null`. Number('') is 0, and silently turning unreadable text into
      // zero years would manufacture a false failure — the one thing this
      // system must never do.
      const digits = rawExperience.replace(/[^0-9.]/g, '');
      const parsed = digits === '' ? Number.NaN : Number(digits);
      if (!Number.isFinite(parsed)) {
        warnings.push(`Row ${lineNumber}: could not read "${rawExperience}" as a number of years — recorded as not provided, so it shows as needs review rather than a failure.`);
      } else {
        experienceYears = parsed;
      }
    }

    const qualifications = parseQualifications(cellOrNull(cells, map.qualifications));
    const certifications = parseCertifications(cellOrNull(cells, map.certifications));

    const blanks: string[] = [];
    if (qualifications === null) blanks.push('qualifications');
    if (certifications === null) blanks.push('certifications');
    if (experienceYears === null) blanks.push('years of experience');
    if (blanks.length) {
      missingDataNotes.push(`${name}: no ${blanks.join(', ')} provided — these will show as "needs review", not as failures.`);
    }

    employees.push({
      id,
      entityId,
      name,
      role,
      qualifications,
      certifications,
      experienceYears,
    });
  });

  return { employees, warnings, missingDataNotes, rowsRead: dataRows.length };
}

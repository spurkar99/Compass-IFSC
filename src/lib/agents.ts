// ---------------------------------------------------------------------------
// THE TWO-AGENT INTAKE PIPELINE
//
//   published circular (text a human supplies)
//        -> Agent 1, the Drafting Agent: proposes a structured rule, and must
//           quote the exact words behind every field it fills in
//        -> Agent 2, the Audit Agent: re-reads the SAME source independently,
//           attacks the draft field by field, and corrects it
//        -> a human signs off on the guideline form before anything is filed
//
// Where this sits matters. These agents work on the INTAKE side only. They turn
// prose into structure — the job deterministic code genuinely cannot do, and the
// one place where being wrong is recoverable because a person approves next.
//
// They never touch the matching engine, and they never decide whether a person
// meets a requirement. That stays deterministic code in engine.ts.
// ---------------------------------------------------------------------------

import type {
  AuditFinding,
  AuditResult,
  DraftResult,
  DraftRule,
  FieldEvidence,
  IntakeResult,
  RequirementType,
} from '@/types';
import { activeModelId, askBedrock } from './ai';
import { credentialMatches, roleMatches } from './normalize';

const REQUIREMENT_TYPES: RequirementType[] = [
  'HAS_CERTIFICATION',
  'CERTIFICATION_NOT_EXPIRED',
  'CERTIFICATION_RENEWED_WITHIN_MONTHS',
  'MIN_EXPERIENCE_YEARS',
  'HAS_QUALIFICATION',
];

const REQUIREMENT_MENU = `
  HAS_CERTIFICATION                     - must hold a named certification. requirementValue = the certification name.
  CERTIFICATION_NOT_EXPIRED             - must hold it AND it must not have expired. requirementValue = the certification name.
  CERTIFICATION_RENEWED_WITHIN_MONTHS   - training/certification completed within N months. requirementValue = the number of months; certificationName = which certification.
  MIN_EXPERIENCE_YEARS                  - at least N years of relevant experience. requirementValue = the number of years.
  HAS_QUALIFICATION                     - holds any ONE of a list of qualifications. requirementValue = the accepted qualifications separated by "; ".
`.trim();

const FIELD_SEMANTICS = `
FIELD SEMANTICS — these are the rules of the target system, not suggestions. Getting a unit
or a matching convention wrong produces a rule that silently matches nobody.

  entityType    An EXACT string match against the entity's recorded type. It must be one of
                the known types listed below, or empty. Never append a qualifier, parenthesis
                or exclusion to it — "Fund Management Entity (excluding X)" matches NOTHING.
  category      An EXACT string match against the entity's recorded category, or empty.
  minAum        A plain number in UNITS OF USD MILLIONS. "USD 200 million" is 200, NOT
                200000000. The comparison applied is: entity AUM >= minAum.
  targetRoles   Job titles matched against the employee's recorded role. Use the role name
                only — never a role plus a condition.
  requirementValue
                For MIN_EXPERIENCE_YEARS: a number of years. For
                CERTIFICATION_RENEWED_WITHIN_MONTHS: a number of months. Otherwise the
                certification or qualification name.
  effectiveDate The date the obligation begins to bite, as YYYY-MM-DD.

CARVE-OUTS AND CONDITIONS THE SCHEMA CANNOT EXPRESS
The schema can express "applies when entity type / category / AUM matches". It CANNOT express
an exclusion ("does not apply to entities that only do X"), a per-scheme condition, or any
other carve-out. When the document contains one:
  - do NOT try to encode it inside entityType, category or targetRoles;
  - keep the carve-out sentence in citationText so it survives filing;
  - state it plainly in notes (drafting) or as a finding (audit) so the human sees that the
    filed rule is BROADER than the document, and must be applied with that in mind.
Silently widening an obligation is the worst outcome available to you. Saying "this carve-out
cannot be represented" is a correct and useful answer.
`.trim();

const EMPTY_DRAFT: DraftRule = {
  title: '',
  citationRef: '',
  citationText: '',
  entityType: '',
  category: '',
  minAum: '',
  targetRoles: [],
  allEmployees: false,
  requirementType: '',
  requirementValue: '',
  certificationName: '',
  effectiveDate: '',
};

// --------------------------- JSON extraction --------------------------------

/**
 * Pull the first JSON object out of a model response. Models sometimes wrap it
 * in a fence or add a sentence either side, so this is deliberately tolerant —
 * but it never guesses at the contents.
 */
function extractJson(text: string): unknown | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidates = [fenced?.[1], text].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function strList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(str).filter(Boolean);
  const single = str(value);
  return single ? [single] : [];
}

/** Coerce whatever the model returned into a DraftRule, dropping anything odd. */
function toDraft(raw: unknown): DraftRule {
  const source = (raw ?? {}) as Record<string, unknown>;
  const requirementType = str(source.requirementType).toUpperCase() as RequirementType;
  return {
    title: str(source.title),
    citationRef: str(source.citationRef),
    citationText: str(source.citationText),
    entityType: str(source.entityType),
    category: str(source.category),
    minAum: str(source.minAum),
    targetRoles: strList(source.targetRoles),
    allEmployees: source.allEmployees === true,
    requirementType: REQUIREMENT_TYPES.includes(requirementType) ? requirementType : '',
    requirementValue: str(source.requirementValue),
    certificationName: str(source.certificationName),
    effectiveDate: /^\d{4}-\d{2}-\d{2}$/.test(str(source.effectiveDate))
      ? str(source.effectiveDate)
      : '',
  };
}

function toEvidence(raw: unknown): FieldEvidence[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      return { field: str(entry.field), quote: str(entry.quote) };
    })
    .filter((item) => item.field);
}

// ------------------------------- Agent 1 ------------------------------------

const DRAFTING_SYSTEM = `You are the Drafting Agent in a regulatory compliance system for
GIFT IFSC entities. You read a published regulatory document and turn ONE obligation in it
into a structured rule that a deterministic engine can check.

You are not deciding whether anyone complies. You are only reading and structuring.

HARD RULES
- Extract only what the document actually says. If the document does not state something,
  leave that field empty. NEVER infer, round, modernise or "helpfully" fill a gap.
- Every field you populate must be justified by a VERBATIM quote from the document. Copy the
  words exactly, including any carve-out or qualifier attached to them.
- Read scope narrowly. If the document restricts an obligation to a subset ("responsible for
  investment decisions", "other than schemes for accredited investors", "managing assets
  above X"), that restriction is part of the rule, not decoration.
- Distinguish the date the obligation takes effect from any deadline for reporting or
  confirming to the regulator. effectiveDate is the former.
- Thresholds written as words ("not less than seven years") must become the number (7).
- If the document contains several distinct obligations, structure the SINGLE most
  significant one and list the others in notes.

REQUIREMENT TYPES — pick exactly one:
${REQUIREMENT_MENU}

${FIELD_SEMANTICS}

TARGET ROLES
- targetRoles: the job titles the obligation applies to, exactly as the document names them.
- allEmployees: true ONLY if it applies to every member of staff regardless of role.

ENTITY SCOPE — leave blank unless the document restricts it:
- entityType   e.g. "Fund Management Entity", "FinTech Entity"
- category     e.g. "Registered FME (Retail)"
- minAum       a number in USD millions, if the obligation only bites above an AUM threshold

Reply with ONLY a JSON object, no prose around it:
{
  "title": "short human title",
  "citationRef": "the circular/regulation reference and date, as printed",
  "citationText": "the operative sentence(s), verbatim",
  "entityType": "", "category": "", "minAum": "",
  "targetRoles": ["..."], "allEmployees": false,
  "requirementType": "ONE_OF_THE_ABOVE",
  "requirementValue": "...", "certificationName": "",
  "effectiveDate": "YYYY-MM-DD",
  "evidence": [ { "field": "targetRoles", "quote": "exact words from the document" } ],
  "notes": ["anything the document leaves unstated, or other obligations you did not structure"]
}`;

export async function runDraftingAgent(sourceText: string): Promise<DraftResult | null> {
  const reply = await askBedrock(
    DRAFTING_SYSTEM,
    `Regulatory document:\n\n<<<\n${sourceText}\n>>>\n\nStructure the principal obligation as JSON.`,
    3000,
    // Extraction from a short document; 'medium' is enough and keeps the demo brisk.
    'medium',
  );
  if (!reply) return null;
  const parsed = extractJson(reply);
  if (!parsed) return null;
  const source = parsed as Record<string, unknown>;
  return {
    draft: toDraft(parsed),
    evidence: toEvidence(source.evidence),
    notes: strList(source.notes),
  };
}

// ------------------------------- Agent 2 ------------------------------------

const AUDIT_SYSTEM = `You are the Audit Agent in a regulatory compliance system. Another
agent has read a regulatory document and produced a structured draft rule. Your job is to
find what it got wrong.

Work from the DOCUMENT, not from the draft's reasoning. Re-derive each field yourself first,
then compare.

Check every one of these, and say so even when the answer is "fine":
1. GROUNDING — is each populated field actually supported by words in the document? A value
   with no textual basis is a BLOCKER, however plausible it looks.
2. INVENTED SPECIFICITY — a threshold, date, certification name or qualification the document
   never states. BLOCKER.
3. SCOPE CREEP — does the draft apply the obligation more widely than the document does?
   Dropped carve-outs, dropped "responsible for X" qualifiers, a missing AUM or entity-type
   restriction, allEmployees set when only named roles are covered. BLOCKER.
4. SCOPE UNDER-REACH — does the draft miss roles or entities the document plainly covers?
5. DATES — is effectiveDate the date the obligation begins, not a reporting deadline?
6. REQUIREMENT TYPE — is it the right one? "must hold X" is HAS_CERTIFICATION; "must hold a
   valid, unexpired X" is CERTIFICATION_NOT_EXPIRED; a recurring refresher is
   CERTIFICATION_RENEWED_WITHIN_MONTHS.
7. FIELD SEMANTICS — is every value in the units and matching form the target system expects?

${FIELD_SEMANTICS}

Keep it tight: at most 8 findings. Report OK only for fields where the check was material —
do not pad the list with trivially-empty fields.

Your corrections must obey the field semantics above. If you "fix" a field into a form the
system cannot match, you have broken the rule rather than repaired it.

Severity: BLOCKER = must not be filed as drafted. WARNING = a judgement call a human should
see. OK = checked and correct.

Verdict: "APPROVE" if every finding is OK. "CORRECT" if you are supplying fixes.
"REJECT" if the document does not actually contain a checkable obligation.

If you change anything, return the complete corrected rule in correctedDraft — every field,
not only the ones you changed.

Reply with ONLY a JSON object:
{
  "verdict": "APPROVE" | "CORRECT" | "REJECT",
  "summary": "one or two sentences a compliance officer can act on",
  "findings": [ { "field": "...", "severity": "BLOCKER|WARNING|OK", "issue": "...", "quote": "exact words from the document, or empty", "suggested": "the value you believe is right, or empty" } ],
  "correctedDraft": null | {
    "title": "...", "citationRef": "...", "citationText": "...",
    "entityType": "", "category": "", "minAum": "",
    "targetRoles": ["..."], "allEmployees": false,
    "requirementType": "...", "requirementValue": "...", "certificationName": "",
    "effectiveDate": "YYYY-MM-DD"
  }
}`;

export async function runAuditAgent(
  sourceText: string,
  draft: DraftRule,
): Promise<AuditResult | null> {
  const reply = await askBedrock(
    AUDIT_SYSTEM,
    `Regulatory document:\n\n<<<\n${sourceText}\n>>>\n\nDraft rule produced by the other agent:\n\n${JSON.stringify(draft, null, 2)}\n\nAudit it.`,
    3000,
    // The adversarial pass is the one that must not be lazy.
    'high',
  );
  if (!reply) return null;
  const parsed = extractJson(reply);
  if (!parsed) return null;
  const source = parsed as Record<string, unknown>;

  const verdictRaw = str(source.verdict).toUpperCase();
  const verdict: AuditResult['verdict'] =
    verdictRaw === 'APPROVE' || verdictRaw === 'CORRECT' || verdictRaw === 'REJECT'
      ? verdictRaw
      : 'CORRECT';

  const findings: AuditFinding[] = Array.isArray(source.findings)
    ? source.findings.map((item) => {
        const entry = (item ?? {}) as Record<string, unknown>;
        const severityRaw = str(entry.severity).toUpperCase();
        return {
          field: str(entry.field) || 'general',
          severity:
            severityRaw === 'BLOCKER' || severityRaw === 'WARNING' || severityRaw === 'OK'
              ? severityRaw
              : 'WARNING',
          issue: str(entry.issue),
          quote: str(entry.quote),
          suggested: str(entry.suggested),
        };
      })
    : [];

  const corrected = source.correctedDraft ? toDraft(source.correctedDraft) : null;
  return { verdict, summary: str(source.summary), findings, correctedDraft: corrected };
}

// ------------------- deterministic validation of agent output ---------------
//
// Neither agent can be talked out of this. It is ordinary code, it runs on the
// draft that is about to be shown for sign-off, and it checks the things the
// schema actually requires — units, exact-match fields, enum membership. The
// agents above are good at reading prose and bad at remembering that minAum is
// denominated in millions; this is the backstop for exactly that.

export interface SchemaIssue {
  field: string;
  severity: 'BLOCKER' | 'WARNING';
  issue: string;
  /** Deterministically repaired value, where a repair is unambiguous. */
  repairedTo?: string;
}

export interface ValidationOutcome {
  issues: SchemaIssue[];
  /** The draft with any unambiguous repairs applied. */
  draft: DraftRule;
}

const NUMERIC_REQUIREMENTS: RequirementType[] = [
  'MIN_EXPERIENCE_YEARS',
  'CERTIFICATION_RENEWED_WITHIN_MONTHS',
];

export interface KnownVocabulary {
  entityTypes: string[];
  /** Certification names that actually appear on employee records. */
  certifications: string[];
  /** Roles that actually appear on employee records. */
  roles: string[];
}

export function validateDraft(
  input: DraftRule,
  vocabulary: KnownVocabulary | string[],
): ValidationOutcome {
  // Accept a bare list of entity types for convenience/back-compat.
  const known: KnownVocabulary = Array.isArray(vocabulary)
    ? { entityTypes: vocabulary, certifications: [], roles: [] }
    : vocabulary;
  const knownEntityTypes = known.entityTypes;
  const draft: DraftRule = { ...input };
  const issues: SchemaIssue[] = [];

  // entityType must match an entity's recorded type exactly.
  if (draft.entityType) {
    const exact = knownEntityTypes.find(
      (type) => type.toLowerCase() === draft.entityType.trim().toLowerCase(),
    );
    if (exact) {
      draft.entityType = exact;
    } else {
      const embedded = knownEntityTypes.find((type) =>
        draft.entityType.toLowerCase().includes(type.toLowerCase()),
      );
      if (embedded) {
        issues.push({
          field: 'entityType',
          severity: 'BLOCKER',
          issue: `"${draft.entityType}" carries a qualifier. This field is an exact string match, so as written it would match no entity at all. The qualifier has been stripped — check that the condition it expressed is recorded in the citation text, because the filed rule will not enforce it.`,
          repairedTo: embedded,
        });
        draft.entityType = embedded;
      } else {
        issues.push({
          field: 'entityType',
          severity: 'BLOCKER',
          issue: `"${draft.entityType}" is not a registered entity type (${knownEntityTypes.join(', ')}). As an exact match it would reach nobody.`,
        });
      }
    }
  }

  // minAum is denominated in USD millions.
  if (draft.minAum) {
    const value = Number(draft.minAum);
    if (!Number.isFinite(value) || value < 0) {
      issues.push({
        field: 'minAum',
        severity: 'BLOCKER',
        issue: `"${draft.minAum}" is not a usable number.`,
      });
    } else if (value >= 1_000_000) {
      const millions = value / 1_000_000;
      issues.push({
        field: 'minAum',
        severity: 'BLOCKER',
        issue: `${value.toLocaleString()} looks like a raw currency amount. This field is in USD millions, so that figure would be read as USD ${value.toLocaleString()} million and the rule would reach no entity. Converted to ${millions}.`,
        repairedTo: String(millions),
      });
      draft.minAum = String(millions);
    }
  }

  if (!draft.requirementType) {
    issues.push({
      field: 'requirementType',
      severity: 'BLOCKER',
      issue: 'No requirement type the engine recognises was identified, so nothing can be checked.',
    });
  } else if (NUMERIC_REQUIREMENTS.includes(draft.requirementType)) {
    const value = Number(draft.requirementValue);
    if (!Number.isFinite(value) || value <= 0) {
      issues.push({
        field: 'requirementValue',
        severity: 'BLOCKER',
        issue: `${draft.requirementType} needs a positive number; "${draft.requirementValue}" is not one.`,
      });
    }
  } else if (!draft.requirementValue) {
    issues.push({
      field: 'requirementValue',
      severity: 'BLOCKER',
      issue: 'No certification or qualification name was identified.',
    });
  }

  if (draft.requirementType === 'CERTIFICATION_RENEWED_WITHIN_MONTHS' && !draft.certificationName) {
    issues.push({
      field: 'certificationName',
      severity: 'BLOCKER',
      issue: 'A renewal-interval rule must name the certification being renewed.',
    });
  }

  if (!draft.allEmployees && draft.targetRoles.length === 0) {
    issues.push({
      field: 'targetRoles',
      severity: 'BLOCKER',
      issue: 'No target role was identified, and the rule is not marked as applying to all staff.',
    });
  }

  draft.targetRoles.forEach((role) => {
    if (/[(),]|\bexcept\b|\bexcluding\b|\bwho\b|\bresponsible for\b/i.test(role)) {
      issues.push({
        field: 'targetRoles',
        severity: 'WARNING',
        issue: `"${role}" reads as a role plus a condition. Roles are matched on the title alone, so the condition will not be enforced — confirm the plain role name is right.`,
      });
    }
  });

  if (!draft.effectiveDate) {
    issues.push({
      field: 'effectiveDate',
      severity: 'BLOCKER',
      issue: 'No effective date was identified.',
    });
  }
  if (!draft.citationRef) {
    issues.push({
      field: 'citationRef',
      severity: 'BLOCKER',
      issue: 'No citation reference was identified. A rule with no traceable source cannot be filed.',
    });
  }
  if (!draft.citationText) {
    issues.push({
      field: 'citationText',
      severity: 'BLOCKER',
      issue: 'No source text was captured, so the filed rule would not carry its own wording.',
    });
  }

  // Does the credential this rule names actually exist on any employee record?
  //
  // A regulator writes "an anti-money laundering refresher programme"; an HR
  // system records "AML/CFT Training Certificate". Both are correct, and the
  // engine will not match them. Filing the regulator's wording unchanged would
  // flag the entire workforce, so the mismatch has to reach the human.
  const credentialField =
    draft.requirementType === 'CERTIFICATION_RENEWED_WITHIN_MONTHS'
      ? 'certificationName'
      : draft.requirementType === 'HAS_CERTIFICATION' ||
          draft.requirementType === 'CERTIFICATION_NOT_EXPIRED'
        ? 'requirementValue'
        : null;

  if (credentialField && known.certifications.length > 0) {
    const named = credentialField === 'certificationName' ? draft.certificationName : draft.requirementValue;
    if (named && !known.certifications.some((held) => credentialMatches(named, held))) {
      issues.push({
        field: credentialField,
        severity: 'BLOCKER',
        issue: `No certification on any employee record matches "${named}". The engine matches on the recorded name, so filing this would flag everyone the rule targets. Either the workforce genuinely holds nothing like it, or — more likely — the regulator's wording differs from the name your records use. Map it to one of: ${known.certifications.slice(0, 8).join('; ')}.`,
      });
    }
  }

  if (draft.requirementType === 'HAS_QUALIFICATION' && draft.requirementValue) {
    const accepted = draft.requirementValue.split(';').map((value) => value.trim()).filter(Boolean);
    if (accepted.length === 0) {
      issues.push({
        field: 'requirementValue',
        severity: 'BLOCKER',
        issue: 'No accepted qualifications were listed.',
      });
    }
  }

  // Roles that nobody holds are legitimate (a rule can land before the hire),
  // but the human should know the rule will currently reach no one.
  if (!draft.allEmployees && known.roles.length > 0) {
    const unmatched = draft.targetRoles.filter(
      (role) => !known.roles.some((held) => roleMatches(role, held)),
    );
    if (unmatched.length > 0) {
      issues.push({
        field: 'targetRoles',
        severity: 'WARNING',
        issue: `Nobody on any roster currently holds ${unmatched.map((role) => `"${role}"`).join(' or ')}. The rule will be filed and will apply the moment such a person is added, but right now it reaches no one — check the title matches what your records use.`,
      });
    }
  }

  return { issues, draft };
}

// ---------------------------- the pipeline ----------------------------------

/**
 * Run both agents over one document, then validate the result deterministically.
 *
 * Three layers, in order of how much they can be argued with:
 *   1. Drafting Agent  — reads prose, proposes structure, quotes its sources
 *   2. Audit Agent     — re-reads the source and attacks the draft
 *   3. validateDraft() — ordinary code; checks units, exact-match fields, enums
 * Then a human signs off. Nothing is filed by any of the three.
 *
 * The UI gets everything all three produced, not just the outcome — whoever
 * signs off needs to see the working.
 */
export async function runIntake(
  sourceText: string,
  vocabulary: KnownVocabulary = { entityTypes: [], certifications: [], roles: [] },
): Promise<IntakeResult> {
  const trimmed = sourceText.trim();
  if (trimmed.length < 80) {
    return {
      ok: false,
      sourceChars: trimmed.length,
      error: 'Paste the text of the circular — at least a couple of sentences.',
    };
  }
  if (trimmed.length > 20000) {
    return {
      ok: false,
      sourceChars: trimmed.length,
      error: 'That document is too long for the prototype. Paste the relevant clause or section.',
    };
  }

  const startDraft = Date.now();
  const drafting = await runDraftingAgent(trimmed);
  const draftingMs = Date.now() - startDraft;

  if (!drafting) {
    return {
      ok: false,
      unavailable: true,
      sourceChars: trimmed.length,
      error:
        'Both intake agents need AWS Bedrock, and the call did not succeed. Nothing was drafted — enter the guideline by hand in the form below, or run `npm run check-ai` to test the credentials.',
    };
  }

  const startAudit = Date.now();
  const audit = await runAuditAgent(trimmed, drafting.draft);
  const auditMs = Date.now() - startAudit;

  // No audit means no sign-off packet. Say so rather than quietly presenting an
  // unreviewed draft as though two agents had agreed on it.
  if (!audit) {
    const solo = validateDraft({ ...EMPTY_DRAFT, ...drafting.draft }, vocabulary);
    return {
      ok: false,
      sourceChars: trimmed.length,
      drafting,
      proposed: solo.draft,
      schemaIssues: solo.issues,
      model: activeModelId(),
      timings: { draftingMs, auditMs },
      error:
        'The Drafting Agent produced a draft, but the Audit Agent could not be reached, so nothing has checked it. Treat the draft below as unreviewed.',
    };
  }

  const chosen =
    audit.correctedDraft && audit.verdict !== 'APPROVE' ? audit.correctedDraft : drafting.draft;
  const validated = validateDraft({ ...EMPTY_DRAFT, ...chosen }, vocabulary);

  return {
    ok: true,
    sourceChars: trimmed.length,
    drafting,
    audit,
    proposed: validated.draft,
    schemaIssues: validated.issues,
    model: activeModelId(),
    timings: { draftingMs, auditMs },
  };
}

// ---------------------------------------------------------------------------
// The ONLY two places AI is used in this product:
//   1. Writing the plain-English impact memo for a notification.
//   2. Answering questions about the rule texts, citation-first.
//
// Neither one decides anything. The engine has already worked out who is
// flagged and why; AI is only allowed to put that into readable prose, or to
// quote rule text back. If AWS Bedrock is not configured — or the call fails
// for any reason — both features fall back to clearly-labelled text written by
// deterministic code, so the app never breaks and never silently pretends an
// AI answered.
// ---------------------------------------------------------------------------

import type { ImpactMemo, Notification, Rule } from '@/types';
import { formatDate } from './dates';
import { describeTargetRole, tight } from './normalize';
import { describeRequirement, summariseRule } from './engine';

const DEFAULT_MODEL = 'anthropic.claude-opus-5';

export function activeModelId(): string {
  return process.env.BEDROCK_MODEL_ID?.trim() || DEFAULT_MODEL;
}

function modelId(): string {
  return process.env.BEDROCK_MODEL_ID?.trim() || DEFAULT_MODEL;
}

/**
 * Build the client options from the environment.
 *
 * If an access key and secret are present we pass them explicitly rather than
 * trusting the ambient AWS credential chain — values loaded from `.env.local`
 * are on `process.env`, but being explicit means the behaviour is the same
 * whether you configure the app through `.env.local`, real shell exports, or
 * an instance role.
 */
export function bedrockOptions(): {
  awsRegion: string;
  awsAccessKey?: string;
  awsSecretAccessKey?: string;
  awsSessionToken?: string;
} {
  const awsRegion = process.env.AWS_REGION?.trim() || 'us-east-1';
  const accessKey = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

  if (accessKey && secretKey) {
    return {
      awsRegion,
      awsAccessKey: accessKey,
      awsSecretAccessKey: secretKey,
      // Only set for temporary/STS credentials; omitted for long-lived keys.
      ...(sessionToken ? { awsSessionToken: sessionToken } : {}),
    };
  }
  // No explicit keys: fall back to whatever the default AWS chain finds
  // (an SSO profile, `aws configure`, an EC2/ECS role, ...).
  return { awsRegion };
}

/** Is there anything configured for Bedrock at all? Used by `npm run check-ai`. */
export function bedrockConfigSummary(): {
  region: string;
  model: string;
  credentials: 'explicit keys' | 'default AWS credential chain';
  disabled: boolean;
} {
  const options = bedrockOptions();
  return {
    region: options.awsRegion,
    model: modelId(),
    credentials: options.awsAccessKey ? 'explicit keys' : 'default AWS credential chain',
    disabled: process.env.COMPASS_DISABLE_AI === '1',
  };
}

/**
 * Ask Bedrock for text. Returns null on any problem at all — a missing
 * package, absent credentials, no model access, a network error — so every
 * caller has one simple path: "if null, use the deterministic fallback".
 */
export async function askBedrock(
  system: string,
  prompt: string,
  maxTokens = 900,
  /** Reasoning depth. Extraction copes at 'medium'; adversarial review wants 'high'. */
  effort: 'low' | 'medium' | 'high' = 'high',
): Promise<string | null> {
  if (process.env.COMPASS_DISABLE_AI === '1') return null;
  try {
    const { AnthropicBedrockMantle } = await import('@anthropic-ai/bedrock-sdk');
    const client = new AnthropicBedrockMantle(bedrockOptions());
    const response = await client.messages.create({
      model: modelId(),
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort },
    });
    const text = response.content
      .filter((block): block is { type: 'text'; text: string; citations: null } =>
        block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    return text || null;
  } catch (error) {
    // Logged for the developer; the user just sees the labelled fallback.
    console.warn('[compass] Bedrock unavailable, using fallback text:', (error as Error).message);
    return null;
  }
}

// --------------------------------------------------------------------------
// 1. Impact memo
// --------------------------------------------------------------------------

/** The facts the memo is allowed to talk about. Nothing else is supplied. */
function memoFacts(notification: Notification): string {
  const lines: string[] = [];
  lines.push(`Entity: ${notification.entityName}`);
  lines.push(`Compliance officer: ${notification.officer.name}`);
  lines.push(
    `Change: a guideline was ${notification.changeType === 'RULE_ADDED' ? 'added' : 'updated'}.`,
  );
  lines.push(`Rule reference: ${notification.rule.id} (version ${notification.rule.version})`);
  lines.push(`Citation: ${notification.rule.citationRef}`);
  lines.push(`Citation text: "${notification.rule.citationText}"`);
  lines.push(`Requirement: ${summariseRule(notification.rule)}`);
  lines.push(`Effective from: ${formatDate(notification.rule.effectiveDate)}`);
  if (notification.previousRule) {
    lines.push(
      `Previous version ${notification.previousRule.version} required: ${String(notification.previousRule.requirement.value)}`,
    );
  }
  if (notification.newlyFlagged.length) {
    lines.push(
      'GROUP A - NEWLY FLAGGED FOR REVIEW. For each of these people we DO hold records; the records simply do not include what the rule requires. This is NOT a case of missing data:',
    );
    notification.newlyFlagged.forEach((person) => {
      lines.push(
        `  - ${person.name} (${person.role}): rule requires "${person.expected}"; the records we hold show "${person.actual}"`,
      );
    });
  } else {
    lines.push('GROUP A - NEWLY FLAGGED FOR REVIEW: nobody.');
  }
  if (notification.newlyNeedsReview.length) {
    lines.push(
      'GROUP B - NEWLY NEEDING REVIEW because the data the check needs was never supplied to us. This IS missing data and is NOT a failure:',
    );
    notification.newlyNeedsReview.forEach((person) => {
      lines.push(`  - ${person.name} (${person.role}): ${person.actual}`);
    });
  } else {
    lines.push('GROUP B - NEWLY NEEDING REVIEW (missing data): nobody.');
  }
  if (notification.noLongerFlagged.length) {
    lines.push('No longer flagged:');
    notification.noLongerFlagged.forEach((person) => {
      lines.push(`  - ${person.name} (${person.role})`);
    });
  }
  return lines.join('\n');
}

const MEMO_SYSTEM = `You write short internal compliance notes for a compliance officer at a
GIFT IFSC financial entity.

Absolute rules:
- Use ONLY the facts given to you. Never add a name, number, date or obligation that is not there.
- Never state or imply that a person IS non-compliant or has broken a rule. The correct framing is
  that they are "flagged for review" and that the officer must decide.
- GROUP A and GROUP B mean different things and you must never blur them:
    * GROUP A (flagged for review) - we hold this person's records, and those records do not show
      what the rule requires. Do NOT call this missing data, an absent record or an incomplete
      file. Say instead that the records we hold do not show the required item.
    * GROUP B (needing review) - the data the check needs was never supplied. Only for these
      people may you say data is missing, and there you should add that missing data is not a
      failure.
  If a group is empty, do not mention that group at all.
- Never infer anyone's gender from their name. Nobody's pronouns are recorded here, so use
  "they/them", or repeat the person's name, for every individual you mention.
- Plain English. No jargon, no bullet-point padding, no headings, no sign-off.
- 3 short paragraphs at most, around 120 words total.`;

function fallbackMemo(notification: Notification): string {
  const flagged = notification.newlyFlagged;
  const review = notification.newlyNeedsReview;
  const verb = notification.changeType === 'RULE_ADDED' ? 'A new guideline' : 'An updated guideline';

  const parts: string[] = [];
  parts.push(
    `${verb} (${notification.rule.citationRef}) takes effect on ${formatDate(notification.rule.effectiveDate)}. It requires that ${describeTargetRole(notification.rule.targetRole).toLowerCase()} at ${notification.entityName} meet this condition: ${describeRequirement(notification.rule).toLowerCase()}.`,
  );

  if (flagged.length === 0 && review.length === 0) {
    parts.push(
      'On the employee data currently held, nobody at this entity is newly affected. No individual action appears to be needed, but the obligation now applies and should be acknowledged.',
    );
  } else {
    if (flagged.length > 0) {
      const names = flagged.map((person) => `${person.name} (${person.role})`).join(' and ');
      parts.push(
        `${flagged.length === 1 ? 'One person is' : `${flagged.length} people are`} flagged for your review: ${names}. Records are held for each of them, and those records do not show the required item — ${flagged[0].name}'s record shows "${flagged[0].actual}". This is a prompt to check, not a finding that anyone has breached anything.`,
      );
    }
    if (review.length > 0) {
      const names = review.map((person) => person.name).join(', ');
      parts.push(
        `${review.length === 1 ? 'One record' : `${review.length} records`} could not be checked at all because data is missing (${names}). Missing data is not a failure — it means the roster needs completing before any conclusion can be drawn.`,
      );
    }
    parts.push(
      `Next step: ${notification.officer.name} to review each person above and record a decision.`,
    );
  }
  return parts.join('\n\n');
}

export async function generateImpactMemo(notification: Notification): Promise<ImpactMemo> {
  const generatedAt = new Date().toISOString();
  const text = await askBedrock(
    MEMO_SYSTEM,
    `Write the note for the compliance officer, based only on these facts:\n\n${memoFacts(notification)}`,
  );
  if (text) {
    return { text, source: 'bedrock', generatedAt, model: modelId() };
  }
  return { text: fallbackMemo(notification), source: 'fallback', generatedAt };
}

// --------------------------------------------------------------------------
// 2. Citation-first Q&A
// --------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'is', 'are', 'be', 'do', 'does',
  'what', 'which', 'who', 'whom', 'how', 'when', 'must', 'need', 'needs', 'i', 'we', 'my',
  'our', 'it', 'this', 'that', 'there', 'any', 'can', 'should', 'has', 'have', 'about', 'on',
  'at', 'by', 'with', 'from', 'as', 'if', 'not', 'no',
  // Filler in this domain — these appear in almost every rule, so matching on
  // them alone tells us nothing about relevance.
  'requirement', 'requirements', 'required', 'require', 'rule', 'rules', 'ifsca',
  'entity', 'entities', 'shall', 'person', 'people', 'staff', 'employee', 'employees',
]);

export interface RetrievedRule {
  rule: Rule;
  score: number;
}

/**
 * Retrieval is deterministic keyword overlap over the handful of rule texts —
 * no embeddings, no vector store. With this few documents it is accurate and
 * you can see exactly why a rule was retrieved.
 */
export function retrieveRules(question: string, rules: Rule[], limit = 3): RetrievedRule[] {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));

  const scored = rules.map((rule) => {
    const haystack = tight(
      [rule.title, rule.citationRef, rule.citationText, String(rule.requirement.value), String(rule.targetRole)].join(' '),
    );
    let score = 0;
    let matchedTerms = 0;
    for (const term of new Set(terms)) {
      const needle = tight(term);
      if (!needle) continue;
      if (haystack.includes(needle)) {
        matchedTerms += 1;
        score += needle.length >= 5 ? 2 : 1;
      }
    }
    return { rule, score, matchedTerms };
  });

  // A single incidental word in common is not relevance. Once a question has
  // three or more meaningful words, insist on at least two of them matching,
  // so an out-of-scope question returns nothing rather than a near-miss.
  const floor = new Set(terms).size >= 3 ? 2 : 1;

  return scored
    .filter((item) => item.matchedTerms >= floor)
    .sort((a, b) => b.score - a.score || a.rule.id.localeCompare(b.rule.id))
    .slice(0, limit)
    .map(({ rule, score }) => ({ rule, score }));
}

const QA_SYSTEM = `You answer questions about IFSCA requirements for a compliance officer, using
ONLY the rule extracts supplied in the prompt.

Absolute rules:
- Answer strictly from the supplied extracts. If they do not cover the question, say so plainly
  and stop. Never invent an obligation, a deadline, a threshold or a citation.
- Cite the rule reference (e.g. "R-001 — IFSCA (Fund Management) Regulations, 2022, Regulation 6")
  for every statement you make.
- Never say whether a named individual is compliant. That is decided by the officer, using the
  dashboard, not by you.
- Never infer anyone's gender from their name; use "they/them" if you refer to a person at all.
- Be brief: under 150 words. Plain English.`;

export interface QaAnswer {
  answer: string;
  citations: Array<{ ruleId: string; citationRef: string; citationText: string; title: string }>;
  source: 'bedrock' | 'fallback';
  model?: string;
}

export async function answerQuestion(question: string, rules: Rule[]): Promise<QaAnswer> {
  const retrieved = retrieveRules(question, rules);
  const citations = retrieved.map(({ rule }) => ({
    ruleId: rule.id,
    citationRef: rule.citationRef,
    citationText: rule.citationText,
    title: rule.title,
  }));

  if (retrieved.length === 0) {
    return {
      answer:
        'None of the rules currently loaded appear to cover that question. This prototype only knows the requirements listed on the "Rules & guidelines" page — it will not guess at anything outside them.',
      citations: [],
      source: 'fallback',
    };
  }

  const extracts = retrieved
    .map(
      ({ rule }) =>
        `[${rule.id}] ${rule.title}\nCitation: ${rule.citationRef}\nRequirement: ${summariseRule(rule)}\nEffective: ${formatDate(rule.effectiveDate)}\nText: "${rule.citationText}"`,
    )
    .join('\n\n');

  const text = await askBedrock(
    QA_SYSTEM,
    `Rule extracts:\n\n${extracts}\n\nQuestion: ${question}`,
    600,
  );

  if (text) {
    return { answer: text, citations, source: 'bedrock', model: modelId() };
  }

  // Deterministic fallback: quote the most relevant rules rather than guess.
  const answer = [
    'AWS Bedrock is not configured, so no AI answer was written. Instead, the rules whose text most closely matches your wording are quoted in full below — decide for yourself whether they answer the question. If none of them does, this system holds no rule that covers it.',
    '',
    ...retrieved.map(
      ({ rule }) =>
        `${rule.id} — ${rule.title}\nApplies to: ${describeTargetRole(rule.targetRole)}. Requires: ${describeRequirement(rule)}. Effective ${formatDate(rule.effectiveDate)}.`,
    ),
  ].join('\n');

  return { answer, citations, source: 'fallback' };
}

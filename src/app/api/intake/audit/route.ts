import { NextResponse } from 'next/server';
import { runAuditAgent, validateDraft } from '@/lib/agents';
import { activeModelId } from '@/lib/ai';
import { currentVocabulary } from '@/lib/intake-vocabulary';
import type { DraftRule } from '@/types';

/**
 * Stage 2: the Audit Agent re-reads the same document and attacks the draft,
 * then the deterministic validator checks whatever survives.
 *
 * This endpoint saves nothing. Filing stays a separate, human-initiated call
 * to /api/guidelines.
 */
export async function POST(request: Request) {
  let sourceText = '';
  let draft: DraftRule | null = null;
  try {
    const body = (await request.json()) as { sourceText?: string; draft?: DraftRule };
    sourceText = body.sourceText ?? '';
    draft = body.draft ?? null;
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read the request.' }, { status: 400 });
  }
  if (!sourceText.trim() || !draft) {
    return NextResponse.json({ ok: false, error: 'Nothing to audit.' }, { status: 400 });
  }

  const vocabulary = await currentVocabulary();
  const started = Date.now();
  const audit = await runAuditAgent(sourceText.trim(), draft);

  if (!audit) {
    const solo = validateDraft(draft, vocabulary);
    return NextResponse.json({
      ok: false,
      proposed: solo.draft,
      schemaIssues: solo.issues,
      elapsedMs: Date.now() - started,
      error:
        'The Audit Agent could not be reached, so nothing has checked the draft. Treat it as unreviewed.',
    });
  }

  const chosen = audit.correctedDraft && audit.verdict !== 'APPROVE' ? audit.correctedDraft : draft;
  const validated = validateDraft(chosen, vocabulary);

  return NextResponse.json({
    ok: true,
    audit,
    proposed: validated.draft,
    schemaIssues: validated.issues,
    usedCorrectedDraft: Boolean(audit.correctedDraft && audit.verdict !== 'APPROVE'),
    model: activeModelId(),
    elapsedMs: Date.now() - started,
  });
}

import { NextResponse } from 'next/server';
import { runDraftingAgent } from '@/lib/agents';
import { activeModelId } from '@/lib/ai';

/** Stage 1: the Drafting Agent reads the document and proposes a structured rule. */
export async function POST(request: Request) {
  let sourceText = '';
  try {
    sourceText = ((await request.json()) as { sourceText?: string }).sourceText ?? '';
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read the request.' }, { status: 400 });
  }

  const trimmed = sourceText.trim();
  if (trimmed.length < 80) {
    return NextResponse.json({
      ok: false,
      error: 'Paste the text of the circular — at least a couple of sentences.',
    });
  }
  if (trimmed.length > 20000) {
    return NextResponse.json({
      ok: false,
      error: 'That document is too long for the prototype. Paste the relevant clause or section.',
    });
  }

  const started = Date.now();
  const drafting = await runDraftingAgent(trimmed);
  if (!drafting) {
    return NextResponse.json({
      ok: false,
      unavailable: true,
      error:
        'The Drafting Agent needs AWS Bedrock and the call did not succeed. Nothing was drafted — enter the guideline by hand below, or run `npm run check-ai` to test the credentials.',
    });
  }
  return NextResponse.json({
    ok: true,
    drafting,
    model: activeModelId(),
    elapsedMs: Date.now() - started,
  });
}

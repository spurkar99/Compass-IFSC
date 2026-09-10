import { NextResponse } from 'next/server';
import { answerQuestion } from '@/lib/ai';
import { getActiveRules } from '@/lib/store';

/** The one place RAG is allowed: citation-first Q&A over the rule texts. */
export async function POST(request: Request) {
  let question = '';
  try {
    const body = (await request.json()) as { question?: string };
    question = (body.question ?? '').trim();
  } catch {
    // fall through to the validation below
  }
  if (!question) {
    return NextResponse.json({ ok: false, error: 'Ask a question first.' }, { status: 400 });
  }

  const rules = await getActiveRules();
  const result = await answerQuestion(question, rules);
  return NextResponse.json({ ok: true, question, ...result });
}

import { NextResponse } from 'next/server';
import { SAMPLE_CIRCULARS } from '@/lib/bundled-text';

/**
 * The sample circulars used to demonstrate the intake agents. They live as
 * plain text files in data/sample-circulars/ so what the agents were given is
 * exactly what you can read; scripts/bundle-text.mjs compiles them into the
 * build so they are present wherever the app runs, including on Lambda.
 */
export async function GET() {
  return NextResponse.json({ ok: true, documents: SAMPLE_CIRCULARS });
}

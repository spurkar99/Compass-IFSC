import { NextResponse } from 'next/server';
import { resetToSeed } from '@/lib/store';

/** Restore /data from /data/seed so the demo can be run again from the top. */
export async function POST() {
  const restored = await resetToSeed();
  return NextResponse.json({ ok: true, restored });
}

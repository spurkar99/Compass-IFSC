import { NextResponse } from 'next/server';
import { updateNotification } from '@/lib/store';

/**
 * The human decision. Nothing in this product is final until a person records
 * that they have looked at the finding — this is where that happens.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: { note?: string; reviewedBy?: string } = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is fine — the note is optional.
  }

  const updated = await updateNotification(id, {
    status: 'CONFIRMED',
    reviewedAt: new Date().toISOString(),
    reviewedBy: body.reviewedBy?.trim() || 'Compliance officer',
    reviewNote: body.note?.trim() || undefined,
  });

  if (!updated) {
    return NextResponse.json({ ok: false, error: 'Notification not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, notification: updated });
}

import { NextResponse } from 'next/server';
import { generateImpactMemo } from '@/lib/ai';
import { getNotifications, updateNotification } from '@/lib/store';

/** Optional AI garnish: turn an existing finding into readable prose. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const notification = (await getNotifications()).find((item) => item.id === id);
  if (!notification) {
    return NextResponse.json({ ok: false, error: 'Notification not found.' }, { status: 404 });
  }

  const impactMemo = await generateImpactMemo(notification);
  await updateNotification(id, { impactMemo });
  return NextResponse.json({ ok: true, impactMemo });
}

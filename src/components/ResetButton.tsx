'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Restores /data from /data/seed so the demo can be run again from the top. */
export function ResetButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset() {
    if (!window.confirm('Restore the seed data? Any guidelines you added and any notifications will be discarded.')) {
      return;
    }
    setBusy(true);
    try {
      await fetch('/api/reset', { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn-secondary" onClick={reset} disabled={busy}>
      {busy ? 'Resetting…' : 'Reset demo data'}
    </button>
  );
}

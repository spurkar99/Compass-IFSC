import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/Nav';
import { getNotifications } from '@/lib/store';

export const metadata: Metadata = {
  title: 'Compass IFSC — employee compliance layer',
  description:
    'Structured IFSCA requirements checked against employee records, flagging possible gaps for a compliance officer to review.',
  icons: { icon: '/icon.svg' },
};

// The prototype reads JSON files on every request, so nothing may be cached.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const notifications = await getNotifications();
  const newAlertCount = notifications.filter((item) => item.status === 'NEW').length;

  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas font-sans antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav newAlertCount={newAlertCount} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/rules', label: 'Guidelines' },
  { href: '/company', label: 'Companies' },
  { href: '/ask', label: 'Ask' },
  { href: '/self-check', label: 'Self-check' },
  { href: '/provenance', label: 'Real vs. mocked' },
];

export function Nav({ newAlertCount }: { newAlertCount: number }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-brand-soft bg-brand text-slate-300 md:h-screen md:w-64 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2.5 px-5 py-5 text-white">
        <Logo className="h-7 w-7 text-accent" />
        <div>
          <div className="text-[15px] font-semibold leading-tight">Compass IFSC</div>
          <div className="text-[11px] leading-tight text-slate-400">Employee compliance layer</div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex shrink-0 items-center justify-between gap-2 rounded px-3 py-2 text-[13px]
                          transition-colors ${
                            active
                              ? 'bg-accent/15 font-medium text-white ring-1 ring-accent/40'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
            >
              <span>{link.label}</span>
              {link.href === '/' && newAlertCount > 0 ? (
                <span className="rounded-full bg-flag px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {newAlertCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden px-5 py-5 text-[11px] leading-relaxed text-slate-400 md:block">
        Flags gaps for a person to review. It never declares anyone non-compliant.
      </div>
    </aside>
  );
}

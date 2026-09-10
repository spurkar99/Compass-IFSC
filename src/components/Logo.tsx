/** A simple compass rose inside a shield — steady, not flashy. */
export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <path
        d="M16 2.5 27 6.2v10.1c0 6.4-4.4 11.4-11 13.2-6.6-1.8-11-6.8-11-13.2V6.2L16 2.5Z"
        fill="currentColor"
        opacity="0.14"
      />
      <path
        d="M16 2.5 27 6.2v10.1c0 6.4-4.4 11.4-11 13.2-6.6-1.8-11-6.8-11-13.2V6.2L16 2.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="6.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M19.4 12.6 14.2 14.2 12.6 19.4 17.8 17.8 19.4 12.6Z" fill="currentColor" />
    </svg>
  );
}

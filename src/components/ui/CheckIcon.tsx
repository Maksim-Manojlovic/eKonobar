interface Props {
  className?: string;
}

/**
 * Filled-circle check glyph (peach circle + orange tick) used in landing
 * feature/benefit lists. Single source for what was duplicated as `CheckOrange`
 * (for-venues) and byte-identical `CheckCircle` (for-waiters).
 */
export function CheckIcon({ className = "" }: Props) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`flex-shrink-0 mt-0.5 ${className}`}>
      <circle cx="8" cy="8" r="7" fill="#fed7aa" />
      <path d="M5 8L7 10L11 6" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  /** Tailwind size classes for the container box. Default `w-9 h-9`. */
  className?: string;
  /** SVG glyph size in px. Default 20. */
  svg?: number;
}

/**
 * eKonobar logo mark — orange rounded tile + white pin glyph. Single source for
 * the mark that was previously copy-pasted (with cosmetic drift) across the
 * landing nav, auth layout, footers and marketing pages. `.logo-mark` (globals)
 * supplies the orange background + shadow.
 */
export function LogoMark({ className = "w-9 h-9", svg = 20 }: Props) {
  return (
    <div className={`logo-mark rounded-xl flex items-center justify-center flex-shrink-0 ${className}`}>
      <svg width={svg} height={svg} viewBox="0 0 20 20" fill="none">
        <path d="M10 3C7 3 4.5 5.5 4.5 8.5C4.5 12.5 10 18 10 18C10 18 15.5 12.5 15.5 8.5C15.5 5.5 13 3 10 3Z" fill="white" opacity="0.95" />
        <circle cx="10" cy="8.5" r="2.2" fill="white" />
      </svg>
    </div>
  );
}

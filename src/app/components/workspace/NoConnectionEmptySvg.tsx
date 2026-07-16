export function NoConnectionEmptySvg() {
  return (
    <svg aria-hidden="true" viewBox="0 0 180 136" className="h-28 w-40 text-primary">
      <rect
        x="34"
        y="22"
        width="112"
        height="76"
        rx="8"
        fill="hsl(var(--panel-soft))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M52 44h76M52 62h52M52 80h64"
        stroke="hsl(var(--muted-foreground))"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M58 116h64M74 98l-10 18M106 98l10 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="137"
        cy="31"
        r="15"
        fill="hsl(var(--background))"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M131 31h12M137 25v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

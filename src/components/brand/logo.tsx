import { cn } from "@/lib/utils";

/**
 * AETHER CODE VAULT — brand marks.
 *
 * The symbol is an angular vault hexagon enclosing an "A" aperture:
 * a sealed enclosure with a light source inside. It is built from
 * strokes only, so it stays legible from 16px favicons to hero sizes
 * and inherits the surrounding text colour on light or dark surfaces.
 */

type MarkProps = {
  className?: string;
  /** Draws the enclosure at lower contrast for dense UI. */
  quiet?: boolean;
};

export function AetherMark({ className, quiet = false }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Aether Code Vault"
      className={cn("size-8", className)}
      fill="none"
    >
      <path
        d="M16 3.4 27 9.7v12.6L16 28.6 5 22.3V9.7Z"
        stroke="currentColor"
        strokeOpacity={quiet ? 0.35 : 0.55}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10.8 21.4 16 9.8l5.2 11.6"
        stroke="var(--color-primary)"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.1 17.5h5.8"
        stroke="var(--color-primary)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Text-only wordmark, for footers and dense headers. */
export function AetherWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className="font-display text-[0.98em] font-semibold tracking-[0.2em] uppercase">
        Aether
      </span>
      <span className="font-mono text-[0.5em] tracking-[0.42em] text-muted-foreground uppercase">
        Code Vault
      </span>
    </span>
  );
}

/** Primary lockup: symbol + wordmark. */
export function AetherLogo({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const marks = { sm: "size-6", md: "size-8", lg: "size-11" } as const;
  const words = { sm: "text-sm", md: "text-base", lg: "text-2xl" } as const;

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AetherMark className={marks[size]} />
      <AetherWordmark className={words[size]} />
    </span>
  );
}

/** Compact lockup: symbol + single-line name, for app chrome. */
export function AetherCompactLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <AetherMark className="size-6" quiet />
      <span className="font-display text-sm font-semibold tracking-[0.16em] uppercase">
        Aether
      </span>
    </span>
  );
}

/** Loading mark: the aperture pulses while work is in flight. */
export function AetherLoadingMark({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3", className)}
      role="status"
      aria-live="polite"
    >
      <AetherMark className="size-9 animate-beacon" />
      <span className="font-mono text-[11px] tracking-[0.22em] text-muted-foreground uppercase">
        {label}
      </span>
    </div>
  );
}

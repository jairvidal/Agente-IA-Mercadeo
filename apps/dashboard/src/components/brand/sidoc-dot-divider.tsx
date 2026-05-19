import { cn } from "@/lib/utils";

/* Horizontal row of small dots used as a brand divider. The motif is taken
 * straight from the manual's printed applications: business card (p.21),
 * carnet (p.20) and letterhead footer (p.22). Authorized by "Deconstrucción
 * del logo" (manual p.13).
 */

interface SidocDotDividerProps {
  className?: string;
  /** Number of dots in the row. Default 8 to mirror the symbol. */
  count?: number;
  /** Dot diameter in px. Default 4. */
  size?: number;
  /** Tone of the dots. "muted" = current --muted-foreground; "brand" = brand-red. */
  tone?: "muted" | "brand";
}

export function SidocDotDivider({
  className,
  count = 8,
  size = 4,
  tone = "muted",
}: SidocDotDividerProps) {
  return (
    <div
      role="separator"
      aria-hidden="true"
      className={cn("flex items-center gap-1.5", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "block rounded-full",
            tone === "brand" ? "bg-primary" : "bg-muted-foreground/30",
          )}
          style={{ width: size, height: size }}
        />
      ))}
    </div>
  );
}

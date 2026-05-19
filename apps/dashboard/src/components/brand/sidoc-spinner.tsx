import { cn } from "@/lib/utils";

/* Brand-native loader: the 8-dot ring from the Sidoc símbolo (manual p.6, p.13),
 * each dot fading sequentially so the highlight chases around the ring.
 *
 * The "Deconstrucción del logo" clause (manual p.13) explicitly authorizes
 * using the ring as a standalone graphic device — that's what unlocks this.
 *
 * Positions and colors are pulled from /public/favicon.svg (1:1 with the
 * official symbol from the brand PDF). The SVG viewBox is 0 0 512 512.
 */

interface SidocSpinnerProps {
  className?: string;
  /** Total animation cycle in seconds. Default 1.4s. */
  durationSec?: number;
  /** When true, dots dim instead of brighten (use on dark backgrounds). */
  inverse?: boolean;
}

const DOTS = [
  { cx: 218.1, cy: 49.3,  r: 32.3, fill: "#D51C20" }, // top center
  { cx: 334.1, cy: 88.5,  r: 33.1, fill: "#CD712A" }, // top right
  { cx: 414.5, cy: 191.8, r: 32.3, fill: "#F39200" }, // right upper
  { cx: 414.5, cy: 318.7, r: 32.2, fill: "#FEC912" }, // right lower
  { cx: 341.5, cy: 419.9, r: 32.9, fill: "#FAEA29" }, // bottom right
  { cx: 217.0, cy: 461.3, r: 32.7, fill: "#B2B2B2" }, // bottom center
  { cx: 96.7,  cy: 429.8, r: 32.3, fill: "#575756" }, // bottom left
  { cx: 96.7,  cy: 88.7,  r: 32.2, fill: "#D51C20" }, // top left
];

export function SidocSpinner({ className, durationSec = 1.4, inverse }: SidocSpinnerProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      role="status"
      aria-label="Cargando"
      className={cn("h-8 w-8", className)}
    >
      {DOTS.map((dot, i) => {
        const delay = (i / DOTS.length) * durationSec;
        return (
          <circle
            key={i}
            cx={dot.cx}
            cy={dot.cy}
            r={dot.r}
            fill={dot.fill}
            style={{
              transformOrigin: `${dot.cx}px ${dot.cy}px`,
              animation: `sidoc-spin-${inverse ? "inv" : "fwd"} ${durationSec}s ${delay}s linear infinite`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes sidoc-spin-fwd {
          0%, 100% { opacity: 0.25; transform: scale(0.7); }
          25%      { opacity: 1;    transform: scale(1); }
        }
        @keyframes sidoc-spin-inv {
          0%, 100% { opacity: 1;    transform: scale(1); }
          25%      { opacity: 0.25; transform: scale(0.7); }
        }
      `}</style>
    </svg>
  );
}

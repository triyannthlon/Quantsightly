import { cn } from "@/lib/utils";
import { QUADRANT_TO_REGIME_CODE, type QuadrantModelResult } from "@/lib/coredata/four-quadrants";
import { regimeStyleOf } from "./helpers";

const SIZE = 440;
const PAD = 34;
const SCALE = (SIZE - 2 * PAD) / 200; // px par point de coordonnée
const C = SIZE / 2; // centre (x=0, y=0)

const px = (x: number) => PAD + (x + 100) * SCALE;
const py = (y: number) => PAD + (100 - y) * SCALE;

// Teintes pastel (aplats des quadrants) et vives (point courant) — cf. regime-palette.
const AREA: Record<string, string> = { TR: "#dcc08a", TL: "#dba7ad", BR: "#9ec9ae", BL: "#a7c0dd" };
const VIF: Record<string, string> = { TR: "#e9af4b", TL: "#e87386", BR: "#57c198", BL: "#71a1ea" };

export function QuadrantPlane({
  latest,
  history,
  transitionWidth,
}: {
  latest: QuadrantModelResult;
  history: { x: number; y: number }[];
  transitionWidth: number;
}) {
  const T = transitionWidth;
  const code = QUADRANT_TO_REGIME_CODE[latest.quadrant];
  const cx = px(latest.x);
  const cy = py(latest.y);

  // Vecteur vitesse : projeté sur ~6 mois, longueur bornée.
  let arrow: { x: number; y: number } | null = null;
  if (latest.velocity) {
    let dx = latest.velocity.x * 6 * SCALE;
    let dy = -latest.velocity.y * 6 * SCALE;
    const mag = Math.hypot(dx, dy);
    const cap = 58;
    if (mag > cap) {
      dx = (dx / mag) * cap;
      dy = (dy / mag) * cap;
    }
    if (mag > 2) arrow = { x: cx + dx, y: cy + dy };
  }

  const bandX0 = px(-T);
  const bandX1 = px(T);
  const bandY0 = py(T);
  const bandY1 = py(-T);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label="Plan des quatre quadrants" className="max-w-[440px]">
      <defs>
        <marker id="velArrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
          <path d="M0,0 L6,3.5 L0,7 Z" fill={VIF[code]} />
        </marker>
      </defs>

      {/* Aplats des quadrants */}
      <rect x={C} y={PAD} width={SIZE - PAD - C} height={C - PAD} fill={AREA.TR} opacity={0.32} />
      <rect x={PAD} y={PAD} width={C - PAD} height={C - PAD} fill={AREA.TL} opacity={0.32} />
      <rect x={C} y={C} width={SIZE - PAD - C} height={SIZE - PAD - C} fill={AREA.BR} opacity={0.32} />
      <rect x={PAD} y={C} width={C - PAD} height={SIZE - PAD - C} fill={AREA.BL} opacity={0.32} />

      {/* Bandes de transition (dépendent de T) */}
      {T > 0 && (
        <>
          <rect x={bandX0} y={PAD} width={bandX1 - bandX0} height={SIZE - 2 * PAD} fill="#8794a6" opacity={0.14} />
          <rect x={PAD} y={bandY0} width={SIZE - 2 * PAD} height={bandY1 - bandY0} fill="#8794a6" opacity={0.14} />
        </>
      )}

      {/* Axes + cadre */}
      <line x1={PAD} y1={C} x2={SIZE - PAD} y2={C} stroke="currentColor" className="text-border" strokeWidth={1} />
      <line x1={C} y1={PAD} x2={C} y2={SIZE - PAD} stroke="currentColor" className="text-border" strokeWidth={1} />
      <rect x={PAD} y={PAD} width={SIZE - 2 * PAD} height={SIZE - 2 * PAD} fill="none" stroke="currentColor" className="text-border/60" strokeWidth={1} />

      {/* Libellés de coin + axes */}
      <text x={C + 8} y={PAD + 13} fill="currentColor" className={cn("text-[10px]", regimeStyleOf("inflationary-boom").text)}>boom inflationniste</text>
      <text x={C - 8} y={PAD + 13} textAnchor="end" fill="currentColor" className={cn("text-[10px]", regimeStyleOf("inflationary-contraction").text)}>contraction inflat.</text>
      <text x={C + 8} y={SIZE - PAD - 6} fill="currentColor" className={cn("text-[10px]", regimeStyleOf("disinflationary-boom").text)}>boom déflationniste</text>
      <text x={C - 8} y={SIZE - PAD - 6} textAnchor="end" fill="currentColor" className={cn("text-[10px]", regimeStyleOf("disinflationary-contraction").text)}>contraction défl.</text>
      <text x={SIZE - PAD} y={C - 6} textAnchor="end" fill="currentColor" className="text-[10px] text-muted-foreground">activité →</text>
      <text x={C + 6} y={PAD + 26} fill="currentColor" className="text-[10px] text-muted-foreground">↑ inflation</text>

      {/* Trajectoire (secondaire) */}
      {history.length > 1 && (
        <polyline
          points={history.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
          fill="none"
          stroke="currentColor"
          className="text-muted-foreground"
          strokeWidth={1}
          opacity={0.25}
        />
      )}
      {history.slice(0, -1).map((p, i) => {
        const t = i / Math.max(1, history.length - 1);
        return <circle key={i} cx={px(p.x)} cy={py(p.y)} r={1.4 + t * 1.4} fill="currentColor" className="text-muted-foreground" opacity={0.2 + t * 0.35} />;
      })}

      {/* Vecteur vitesse */}
      {arrow && (
        <line x1={cx} y1={cy} x2={arrow.x} y2={arrow.y} stroke={VIF[code]} strokeWidth={2} markerEnd="url(#velArrow)" opacity={0.85} />
      )}

      {/* Point courant */}
      <circle cx={cx} cy={cy} r={6} fill={VIF[code]} stroke="var(--background)" strokeWidth={2} />
    </svg>
  );
}

"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { CountryFlag } from "@/components/ui/CountryFlag";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { REGIME } from "./regime-palette";
import type { AxisSignal } from "@/lib/coredata/quadrant";

export interface QuadrantPoint {
  countryCode: string;
  name: string;
  growthSignal: AxisSignal;
  inflationSignal: AxisSignal;
}

// Placement CATÉGORIEL (pas par valeur) : 4 quadrants, 4 axes (1 seul signal
// neutre), centre (les deux neutres = régime indéterminé).
export type Cell =
  | "TL"
  | "TR"
  | "BL"
  | "BR"
  | "axisTop"
  | "axisBottom"
  | "axisLeft"
  | "axisRight"
  | "center";

export function cellOf(p: QuadrantPoint): Cell {
  const gN = p.growthSignal === "NEUTRAL";
  const iN = p.inflationSignal === "NEUTRAL";
  if (gN && iN) return "center";
  if (gN) return p.inflationSignal === "ACCELERATING" ? "axisTop" : "axisBottom";
  if (iN) return p.growthSignal === "ACCELERATING" ? "axisRight" : "axisLeft";
  const gUp = p.growthSignal === "ACCELERATING";
  if (p.inflationSignal === "ACCELERATING") return gUp ? "TR" : "TL"; // inflation + = haut
  return gUp ? "BR" : "BL"; // inflation − = bas
}

// ─── Contenu pédagogique par quadrant (texte fourni par Yann) ───────────────
interface QInfo {
  label: string;
  axes: string;
  desc: string;
  retenir: string;
  acheter: string;
  reduire: string;
  notionCle?: string;
  color: string;
}
const QUADRANT_INFO: Record<"TR" | "BR" | "TL" | "BL", QInfo> = {
  TR: {
    label: REGIME.TR.label,
    axes: "Croissance ↑ / Inflation ↑",
    desc: "L’économie accélère, mais les prix montent aussi. Les entreprises vendent plus, mais leurs coûts augmentent. C’est un régime de croissance nominale forte.",
    retenir: "La croissance est bonne, mais l’inflation devient un risque.",
    acheter: "Or, matières premières, énergie, actions value, actifs réels.",
    reduire: "Obligations longues, actifs très sensibles à la hausse des taux.",
    notionCle:
      "Une action value est une entreprise déjà rentable, souvent moins chère, parfois cyclique, qui peut profiter de la hausse des prix.",
    color: REGIME.TR.text,
  },
  BR: {
    label: REGIME.BR.label,
    axes: "Croissance ↑ / Inflation ↓",
    desc: "L’économie progresse sans pression forte sur les prix. Les entreprises produisent plus efficacement, souvent grâce à l’innovation, à la technologie ou à une meilleure organisation.",
    retenir: "C’est le régime le plus favorable au capitalisme productif.",
    acheter: "Actions de croissance, entreprises innovantes, obligations longues, actifs de qualité.",
    reduire: "Matières premières, entreprises peu innovantes ou sans avantage compétitif.",
    notionCle:
      "Une action de croissance est une entreprise que le marché valorise surtout pour ses profits futurs : technologie, logiciels, innovation, qualité.",
    color: REGIME.BR.text,
  },
  TL: {
    label: REGIME.TL.label,
    axes: "Croissance ↓ / Inflation ↑",
    desc: "L’économie ralentit, mais les prix continuent de monter. C’est la stagflation : les revenus ralentissent, les coûts augmentent et les marchés deviennent plus difficiles.",
    retenir: "C’est souvent le régime le plus dangereux pour les portefeuilles classiques.",
    acheter: "Cash, or, énergie, actifs défensifs.",
    reduire: "Actions de croissance, obligations longues, entreprises très endettées.",
    notionCle:
      "Le cash protège la flexibilité : il ne cherche pas à gagner beaucoup, mais permet d’attendre et d’éviter les actifs fragiles.",
    color: REGIME.TL.text,
  },
  BL: {
    label: REGIME.BL.label,
    axes: "Croissance ↓ / Inflation ↓",
    desc: "L’économie ralentit et les prix baissent. La dette devient plus lourde à rembourser. Les investisseurs recherchent la sécurité plutôt que la performance.",
    retenir: "Le risque principal n’est plus l’inflation, mais la contraction de l’activité.",
    acheter: "Obligations d’État longues, cash, actifs très sûrs.",
    reduire: "Actions, matières premières, actifs risqués.",
    notionCle:
      "Une obligation longue peut monter lorsque les taux baissent, mais elle souffre fortement si l’inflation ou les taux remontent.",
    color: REGIME.BL.text,
  },
};

export function isQuadrant(c: Cell): c is "TR" | "TL" | "BR" | "BL" {
  return c === "TR" || c === "TL" || c === "BR" || c === "BL";
}

export function signalWord(s: AxisSignal): string {
  return s === "ACCELERATING"
    ? "en accélération"
    : s === "DECELERATING"
      ? "en décélération"
      : "neutre";
}

export interface CountryHover {
  name: string;
  dot: string;
  hasData: boolean;
  regime: string;
  growth: string;
  inflation: string;
  signal: string;
}

/** Données enrichies du tooltip d'un pays (régime + signaux). */
export function countryHover(p: QuadrantPoint): CountryHover {
  const cell = cellOf(p);
  const growth = signalWord(p.growthSignal);
  const inflation = signalWord(p.inflationSignal);
  const signal =
    p.growthSignal !== "NEUTRAL" && p.inflationSignal !== "NEUTRAL" ? "confirmé" : "en transition";
  if (isQuadrant(cell)) {
    return {
      name: p.name,
      dot: REGIME[cell].dot,
      hasData: true,
      regime: QUADRANT_INFO[cell].label,
      growth,
      inflation,
      signal,
    };
  }
  return {
    name: p.name,
    dot: REGIME.transition.dot,
    hasData: true,
    regime: "En transition",
    growth,
    inflation,
    signal,
  };
}

/** Infobulle stylée commune (carte + 2×2), suit le curseur. */
export function CountryTooltip({
  data,
  asOfLabel,
  x,
  y,
}: {
  data: CountryHover;
  asOfLabel: string | null;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none fixed z-50 min-w-44 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md"
      style={{ left: x + 14, top: y + 14 }}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className={cn("size-2.5 shrink-0 rounded-full", data.dot)} />
        {data.name}
      </p>
      {data.hasData ? (
        <div className="mt-1.5 space-y-0.5 text-xs">
          <p>
            <span className="text-muted-foreground">Régime :</span> {data.regime}
          </p>
          <p>
            <span className="text-muted-foreground">Croissance :</span> {data.growth}
          </p>
          <p>
            <span className="text-muted-foreground">Inflation :</span> {data.inflation}
          </p>
          <p>
            <span className="text-muted-foreground">Signal :</span> {data.signal}
          </p>
          {asOfLabel && (
            <p className="mt-1.5 border-t pt-1.5 text-[11px] text-muted-foreground">
              Dernière mise à jour : {asOfLabel}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-0.5 text-xs text-muted-foreground">Sans données</p>
      )}
    </div>
  );
}

type MarkerHover = { p: QuadrantPoint; x: number; y: number } | null;

function Marker({
  p,
  left,
  top,
  onHover,
}: {
  p: QuadrantPoint;
  left: number;
  top: number;
  onHover: (h: MarkerHover) => void;
}) {
  return (
    <div
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center gap-1 rounded-full border bg-background/90 px-1.5 py-0.5 shadow-sm transition-transform duration-150 hover:z-30 hover:scale-125"
      style={{ left: `${left}%`, top: `${top}%` }}
      onMouseMove={(e) => onHover({ p, x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onHover(null)}
    >
      <CountryFlag code={p.countryCode} countryName={p.name} size={16} />
      <span className="text-[10px] font-semibold tabular-nums">{p.countryCode}</span>
    </div>
  );
}

function QuadrantLabel({
  cell,
  corner,
}: {
  cell: "TR" | "BR" | "TL" | "BL";
  corner: "tl" | "tr" | "bl" | "br";
}) {
  const info = QUADRANT_INFO[cell];
  const pos = {
    tl: "left-3 top-3",
    tr: "right-3 top-3",
    bl: "left-3 bottom-3",
    br: "right-3 bottom-3",
  }[corner];
  // Coins gauches → tooltip à droite ; coins droits → à gauche (ouvre vers le
  // centre de la carte, pointe vers le « i »).
  const side = corner === "tl" || corner === "bl" ? "right" : "left";
  return (
    <div
      className={cn(
        "absolute z-20 flex max-w-[48%] items-start gap-1 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 backdrop-blur-sm",
        pos,
      )}
    >
      <span className={cn("text-base font-semibold leading-tight", info.color)}>{info.label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="mt-px shrink-0 cursor-help text-muted-foreground/70 hover:text-foreground"
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className="w-80 space-y-2 text-left leading-relaxed"
        >
          <p className="text-sm font-semibold">{info.label}</p>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Signal</p>
            <p>{info.axes}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
              Comprendre
            </p>
            <p className="text-justify text-wrap">{info.desc}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
              À retenir
            </p>
            <p className="text-wrap">{info.retenir}</p>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5 border-t border-current/20 pt-2">
            <span className="whitespace-nowrap text-right font-semibold">À privilégier :</span>
            <span className="text-wrap">{info.acheter}</span>
            <span className="whitespace-nowrap text-right font-semibold">À réduire :</span>
            <span className="text-wrap">{info.reduire}</span>
          </div>

          {info.notionCle && (
            <div className="border-t border-current/20 pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
                Notion clé
              </p>
              <p className="text-justify text-wrap">{info.notionCle}</p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

interface ZoneStyle {
  border: string;
  bg: string;
}
const QUAD: Record<"TL" | "TR" | "BL" | "BR", ZoneStyle> = {
  TL: { border: REGIME.TL.ring, bg: REGIME.TL.ringBg },
  TR: { border: REGIME.TR.ring, bg: REGIME.TR.ringBg },
  BL: { border: REGIME.BL.ring, bg: REGIME.BL.ringBg },
  BR: { border: REGIME.BR.ring, bg: REGIME.BR.ringBg },
};
const NEUTRAL: ZoneStyle = { border: REGIME.transition.ring, bg: REGIME.transition.ringBg };

// Cercle coloré (caractérise la zone) + marqueurs en anneau à l'intérieur,
// rayon croissant avec le nombre de pays mais borné par le cercle.
function Zone({
  points,
  cx,
  cy,
  size,
  style,
  alwaysShow = false,
  onHover,
}: {
  points: QuadrantPoint[];
  cx: number;
  cy: number;
  size: number;
  style: ZoneStyle;
  alwaysShow?: boolean;
  onHover: (h: MarkerHover) => void;
}) {
  const n = points.length;
  if (n === 0 && !alwaysShow) return null;
  const ringR = n <= 1 ? 0 : Math.min(size / 2 - 4, n * 0.95);
  return (
    <>
      <div
        className={cn(
          "absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
          style.border,
          style.bg,
        )}
        style={{ left: `${cx}%`, top: `${cy}%`, width: `${size}%`, aspectRatio: "1" }}
      />
      {n === 1 ? (
        <Marker p={points[0]} left={cx} top={cy} onHover={onHover} />
      ) : (
        points.map((p, k) => {
          const a = -Math.PI / 2 + (2 * Math.PI * k) / n;
          return (
            <Marker
              key={p.countryCode}
              p={p}
              left={cx + ringR * Math.cos(a)}
              top={cy + ringR * Math.sin(a)}
              onHover={onHover}
            />
          );
        })
      )}
    </>
  );
}

export function QuadrantMap({
  points,
  asOfLabel,
}: {
  points: QuadrantPoint[];
  asOfLabel: string | null;
}) {
  const [hover, setHover] = useState<MarkerHover>(null);
  const onHover = (h: MarkerHover) => setHover(h);

  const groups: Record<Cell, QuadrantPoint[]> = {
    TL: [],
    TR: [],
    BL: [],
    BR: [],
    axisTop: [],
    axisBottom: [],
    axisLeft: [],
    axisRight: [],
    center: [],
  };
  for (const p of points) groups[cellOf(p)].push(p);

  const dirClass =
    "absolute z-[15] rounded bg-background/60 px-1 py-0.5 text-xs font-medium text-muted-foreground backdrop-blur-sm whitespace-nowrap";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="grid w-full max-w-4xl grid-cols-[1.75rem_1fr] gap-x-2 gap-y-1.5">
        {/* Titre de l'axe vertical */}
        <div className="relative">
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap text-sm font-semibold text-foreground/80">
            Pression inflationniste
          </span>
        </div>

        <div
          className="relative aspect-square w-full overflow-hidden rounded-xl border bg-card"
          onMouseLeave={() => setHover(null)}
        >
          {/* Teintes de quadrant (couleurs conservées) */}
          <div className="absolute left-0 top-0 h-1/2 w-1/2 bg-rose-500/[0.05]" />
          <div className="absolute right-0 top-0 h-1/2 w-1/2 bg-amber-500/[0.05]" />
          <div className="absolute bottom-0 left-0 h-1/2 w-1/2 bg-blue-500/[0.05]" />
          <div className="absolute bottom-0 right-0 h-1/2 w-1/2 bg-emerald-500/[0.05]" />

          {/* Axes */}
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/30" />
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/30" />

          {/* Étiquettes de direction des axes (à l'intérieur, aux extrémités) */}
          <span className={cn(dirClass, "left-1/2 top-3 -translate-x-1/2")}>
            Inflation accélère ↑
          </span>
          <span className={cn(dirClass, "bottom-3 left-1/2 -translate-x-1/2")}>
            Inflation décélère ↓
          </span>
          <span className={cn(dirClass, "left-3 top-1/2 -translate-y-1/2")}>
            ← Activité ralentit
          </span>
          <span className={cn(dirClass, "right-3 top-1/2 -translate-y-1/2")}>
            Activité accélère →
          </span>

          {/* Titres des quadrants (cartouches + tooltip « i ») */}
          <QuadrantLabel cell="TL" corner="tl" />
          <QuadrantLabel cell="TR" corner="tr" />
          <QuadrantLabel cell="BL" corner="bl" />
          <QuadrantLabel cell="BR" corner="br" />

          {/* 4 quadrants (cercles toujours affichés) */}
          <Zone
            points={groups.TL}
            cx={27}
            cy={27}
            size={42}
            style={QUAD.TL}
            alwaysShow
            onHover={onHover}
          />
          <Zone
            points={groups.TR}
            cx={73}
            cy={27}
            size={42}
            style={QUAD.TR}
            alwaysShow
            onHover={onHover}
          />
          <Zone
            points={groups.BL}
            cx={27}
            cy={73}
            size={42}
            style={QUAD.BL}
            alwaysShow
            onHover={onHover}
          />
          <Zone
            points={groups.BR}
            cx={73}
            cy={73}
            size={42}
            style={QUAD.BR}
            alwaysShow
            onHover={onHover}
          />

          {/* Transitions sur un axe */}
          <Zone
            points={groups.axisTop}
            cx={50}
            cy={15}
            size={18}
            style={NEUTRAL}
            onHover={onHover}
          />
          <Zone
            points={groups.axisBottom}
            cx={50}
            cy={85}
            size={18}
            style={NEUTRAL}
            onHover={onHover}
          />
          <Zone
            points={groups.axisRight}
            cx={85}
            cy={50}
            size={18}
            style={NEUTRAL}
            onHover={onHover}
          />
          <Zone
            points={groups.axisLeft}
            cx={15}
            cy={50}
            size={18}
            style={NEUTRAL}
            onHover={onHover}
          />

          {/* Centre : régime indéterminé */}
          <Zone
            points={groups.center}
            cx={50}
            cy={50}
            size={15}
            style={NEUTRAL}
            onHover={onHover}
          />
        </div>

        {/* Titre de l'axe horizontal */}
        <div aria-hidden />
        <div className="text-center text-sm font-semibold text-foreground/80">
          Activité économique
        </div>
      </div>

      {hover && (
        <CountryTooltip
          data={countryHover(hover.p)}
          asOfLabel={asOfLabel}
          x={hover.x}
          y={hover.y}
        />
      )}
    </TooltipProvider>
  );
}

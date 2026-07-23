"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FrostedDialogContent } from "@/components/custom/ui/frosted-dialog";
import { cn } from "@/lib/utils";
import type { EconomicDataPoint } from "@/lib/coredata/types";
import {
  ExplorationChart,
  type ChartLine,
  type ChartPoint,
} from "../exploration/exploration-chart";

/**
 * Fusionne des séries datées en points de graphe (clé par série). Inliné ici pour que
 * le composant reste AUTONOME (aucune dépendance vers un module de page — ni le moteur
 * 4 Quadrants ni Browne ne fuient dans le bundle des pages qui l'importent).
 */
function mergeChart(series: { key: string; data: EconomicDataPoint[] }[]): ChartPoint[] {
  const byDate = new Map<string, ChartPoint>();
  for (const s of series) {
    for (const p of s.data) {
      let row = byDate.get(p.date);
      if (!row) {
        row = { date: p.date };
        byDate.set(p.date, row);
      }
      row[s.key] = p.value;
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * Série DÉCLARATIVE d'un graphe de carte. Une seule implémentation visuelle pour tout
 * le dossier « Modèles » (4 Quadrants : Vue pays / vs Browne ; Browne : Vue pays) : les
 * différences ne viennent QUE des séries et des KPI transmis, jamais d'un second style.
 */
export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  data: EconomicDataPoint[];
  /** Épaisseur de trait (px) — sert à emphaser une courbe (défaut 2). */
  width?: number;
  dashed?: boolean;
  /** Opacité du remplissage sous la courbe (mode aire / drawdown). */
  fillOpacity?: number;
}

// ─── Synthèse KPI drawdown — PARTAGÉE (Vue pays 4Q, Vue pays Browne, 4Q vs Browne) ──
// Un bloc compact par courbe (max drawdown + durée sous l'eau) + un bloc d'écarts
// FACTUELS optionnel (max drawdown / durée, couleurs favorable-défavorable SÉPARÉES,
// jamais de verdict global). Pure restitution d'affichage — aucun calcul.

const ddPct = (v: number | null) =>
  v === null
    ? "—"
    : `${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const ddMonths = (v: number | null) => (v === null ? "—" : `${Math.round(v)} mois`);
const ddSign = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");
const ddTone = (d: number, higherBetter: boolean, zero: boolean) => {
  if (zero) return "text-muted-foreground";
  const good = higherBetter ? d > 0 : d < 0;
  return good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
};

export interface DrawdownKpiBlock {
  label: string;
  color: string;
  maxDrawdown: number | null;
  underwaterMonths: number | null;
}

export interface DrawdownKpiDelta {
  /** Nom court de la référence (en-tête « Écart vs … »). */
  refLabel: string;
  /** Comparé − référence, en points de %. */
  maxDrawdown: number | null;
  /** Comparé − référence, en mois. */
  underwaterMonths: number | null;
}

export function DrawdownKpiRow({
  blocks,
  delta,
}: {
  blocks: DrawdownKpiBlock[];
  delta?: DrawdownKpiDelta | null;
}) {
  const count = blocks.length + (delta ? 1 : 0);
  return (
    <div className={cn("grid gap-2.5", count <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
      {blocks.map((b) => (
        <div key={b.label} className="rounded-lg border bg-muted/20 p-3">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
            {b.label}
          </span>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Max drawdown</dt>
              <dd className="font-semibold tabular-nums">{ddPct(b.maxDrawdown)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">Sous l’eau</dt>
              <dd className="font-semibold tabular-nums">{ddMonths(b.underwaterMonths)}</dd>
            </div>
          </dl>
        </div>
      ))}
      {delta && <DrawdownDeltaBlock delta={delta} />}
    </div>
  );
}

function DrawdownDeltaBlock({ delta }: { delta: DrawdownKpiDelta }) {
  const rows = [
    {
      label: "Max drawdown",
      d: delta.maxDrawdown,
      higher: true, // moins négatif = favorable
      fmt: (d: number) =>
        `${ddSign(d)}${Math.abs(d).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${Math.abs(d) >= 2 ? "points" : "point"}`,
      zero: (d: number) => Math.round(d * 10) === 0,
    },
    {
      label: "Durée sous l’eau",
      d: delta.underwaterMonths,
      higher: false, // plus courte = favorable
      fmt: (d: number) => `${ddSign(d)}${Math.round(Math.abs(d))} mois`,
      zero: (d: number) => Math.round(d) === 0,
    },
  ];
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Écart vs {delta.refLabel}
      </p>
      <dl className="mt-2 space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd
              className={cn(
                "font-semibold tabular-nums",
                r.d === null ? "text-muted-foreground" : ddTone(r.d, r.higher, r.zero(r.d)),
              )}
            >
              {r.d === null ? "—" : r.fmt(r.d)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type Scale = "linear" | "log";

interface Props {
  title: string;
  subtitle?: string;
  series: ChartSeries[];
  /** ids masqués par défaut (légende interactive : réactivables au clic). */
  defaultHidden?: string[];
  /** Hauteur du graphe intégré en px (défaut 360). Le zoom passe en 78vh. */
  height?: number;
  /** Titre du dialogue agrandi (défaut : `title`). */
  zoomTitle?: string;
  /** Bloc KPI (synthèse) affiché au-dessus du graphe. */
  kpis?: ReactNode;
  /** Message si aucune série visible. */
  emptyLabel?: string;

  // ── Réglages passe-plats vers ExplorationChart ──
  /** Affiche le commutateur Linéaire / Log. */
  scaleToggle?: boolean;
  /** Échelle initiale quand le commutateur est présent (défaut « linear »). */
  defaultScale?: Scale;
  cumulativeTooltip?: boolean;
  percentTooltip?: boolean;
  areaFill?: boolean;
  yDomain?: [number, number];
  extraTooltipRows?: (row: Record<string, number>) => { label: string; value: string }[];
}

/**
 * Carte-graphe partagée du dossier « Modèles ». Rendu STRICTEMENT identique partout :
 * gradient, titre (+ sous-titre) intégré, légende interactive en haut à droite (masquage
 * par clic), commutateur Linéaire / Log optionnel, bloc KPI optionnel au-dessus du graphe,
 * zoom au clic. Accepte 2 ou 3 séries (ou plus) sans changer de composant. Ne fait AUCUN
 * calcul : elle ne restitue que les séries reçues.
 */
export function SeriesChartCard({
  title,
  subtitle,
  series,
  defaultHidden,
  height = 360,
  zoomTitle,
  kpis,
  emptyLabel = "Donnée indisponible.",
  scaleToggle = false,
  defaultScale = "linear",
  cumulativeTooltip = false,
  percentTooltip = false,
  areaFill = false,
  yDomain,
  extraTooltipRows,
}: Props) {
  // Visibilité par id : masquée d'office si dans `defaultHidden`, sinon visible.
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(defaultHidden ?? []));
  const isShown = (id: string) => !hidden.has(id);
  const toggle = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const [userScale, setUserScale] = useState<Scale | null>(null);
  const scale = userScale ?? defaultScale;
  const [zoom, setZoom] = useState(false);

  const chart = useMemo(() => {
    const visible = series.filter((s) => !hidden.has(s.id) && s.data.length > 0);
    if (!visible.length) return null;
    const data = mergeChart(visible.map((s) => ({ key: s.id, data: s.data })));
    // Ordre de tracé : la courbe la plus épaisse (emphase) dessinée en dernier = au-dessus.
    // La LÉGENDE, elle, reste dans l'ordre des `series` fournies.
    const lines: ChartLine[] = visible
      .map((s) => ({
        key: s.id,
        label: s.label,
        color: s.color,
        dashed: s.dashed,
        width: s.width,
        fillOpacity: s.fillOpacity,
      }))
      .sort((a, b) => (a.width ?? 2) - (b.width ?? 2));
    return { data, lines };
  }, [series, hidden]);

  const render = (h: number | string) =>
    chart ? (
      <ExplorationChart
        data={chart.data}
        lines={chart.lines}
        height={h}
        showLegend={false}
        markLast
        gridOpacity={0.22}
        axisLine
        logScale={scale === "log"}
        cumulativeTooltip={cumulativeTooltip}
        percentTooltip={percentTooltip}
        areaFill={areaFill}
        yDomain={yDomain}
        extraTooltipRows={extraTooltipRows}
      />
    ) : null;

  return (
    <Card className="gap-0 bg-gradient-to-b from-foreground/[0.015] to-transparent p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {series.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs transition-colors",
                  isShown(s.id)
                    ? "border-foreground/20 text-foreground"
                    : "border-transparent text-muted-foreground/50 hover:text-foreground",
                )}
              >
                <span
                  className="size-2 rounded-full transition-opacity"
                  style={{ backgroundColor: s.color, opacity: isShown(s.id) ? 1 : 0.35 }}
                />
                {s.label}
              </button>
            ))}
          </div>
          {scaleToggle && (
            <div className="inline-flex items-center rounded-md border border-border/50 bg-background/40 p-0.5 text-xs">
              {(["linear", "log"] as const).map((sc) => (
                <button
                  key={sc}
                  type="button"
                  onClick={() => setUserScale(sc)}
                  className={cn(
                    "cursor-pointer rounded px-2.5 py-1 font-medium transition-all",
                    scale === sc
                      ? "bg-slate-700/70 text-white shadow-sm ring-1 ring-slate-500/50"
                      : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  {sc === "linear" ? "Linéaire" : "Log"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {kpis && <div className="mb-3">{kpis}</div>}
      {chart ? (
        <>
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="cursor-zoom-img block w-full text-left"
            aria-label="Agrandir le graphique"
          >
            {render(height)}
          </button>
          <Dialog open={zoom} onOpenChange={setZoom}>
            <FrostedDialogContent
              className="max-h-[92vh] w-[92vw] max-w-[92vw] sm:max-w-[92vw]"
              showCloseButton
            >
              <DialogTitle className="text-center text-base font-medium">
                {zoomTitle ?? title}
              </DialogTitle>
              {render("78vh")}
            </FrostedDialogContent>
          </Dialog>
        </>
      ) : (
        <div
          className="flex items-center justify-center text-sm text-muted-foreground"
          style={{ height }}
        >
          {emptyLabel}
        </div>
      )}
    </Card>
  );
}

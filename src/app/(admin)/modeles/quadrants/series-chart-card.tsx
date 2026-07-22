"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FrostedDialogContent } from "@/components/custom/ui/frosted-dialog";
import { cn } from "@/lib/utils";
import type { EconomicDataPoint } from "@/lib/coredata/types";
import { ExplorationChart, type ChartLine } from "../../exploration/exploration-chart";
import { mergeChart } from "./helpers";

/**
 * Série DÉCLARATIVE d'un graphe de carte. Une seule implémentation visuelle pour tout
 * le module « 4 Quadrants » (Vue pays, 4 Quadrants vs Browne, …) : les différences ne
 * viennent QUE des séries et des KPI transmis, jamais d'un second style de graphe.
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

/** Tuile KPI atomique (même style que la synthèse de Vue pays). */
export function ChartStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
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
 * Carte-graphe partagée du module « 4 Quadrants ». Rendu STRICTEMENT identique à la
 * carte de Vue pays : gradient, titre (+ sous-titre) intégré, légende interactive en
 * haut à droite (masquage par clic), commutateur Linéaire / Log optionnel, bloc KPI
 * optionnel au-dessus du graphe, zoom au clic. Accepte 2 ou 3 séries (ou plus) sans
 * changer de composant. Ne fait AUCUN calcul : elle ne restitue que les séries reçues.
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

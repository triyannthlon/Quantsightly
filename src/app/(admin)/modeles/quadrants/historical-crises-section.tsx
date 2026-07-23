"use client";

// Section « Comportement pendant les crises » (onglet 4Q vs Browne). Composant CLIENT
// PUR d'affichage : il ne recalcule RIEN, il restitue les `HistoricalCrisisResult[]`
// déjà mesurés côté serveur (mêmes fenêtre / mode / coûts que la comparaison affichée).
// Deux contrôles d'affichage (Mesure, Périmètre) et une bascule ne changent AUCUN calcul.
//
// Barres horizontales groupées (HTML/CSS) : une ligne par crise, 2–3 barres selon les
// stratégies visibles. Tooltip = composant SOMBRE PARTAGÉ (cohérence UI du module). La
// définition longue vit dans un panneau au clic (Dialog), pas dans un tooltip trop large.

import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FrostedDialogContent } from "@/components/custom/ui/frosted-dialog";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipBody } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  bestByMetric,
  crisisUnavailability,
  filterByScope,
  geometry,
  maxAbsValue,
  niceScale,
  strategyValue,
  tickValues,
  type Measure,
  type Scope,
} from "./historical-crises-display";
import type { ComparisonStrategyId } from "@/lib/coredata/model-comparison/types";
import type { HistoricalCrisisResult } from "@/lib/coredata/model-comparison/historical-stress/types";

// ─── Formatage ────────────────────────────────────────────────────────────────

const MONTHS_ABBR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
]; // prettier-ignore
const MONTHS_FULL = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
]; // prettier-ignore

const monthYear = (d: string) => {
  const [y, m] = d.split("-");
  return `${MONTHS_ABBR[Number(m) - 1]} ${y}`;
};
const fullDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${Number(day)} ${MONTHS_FULL[Number(m) - 1]} ${y}`;
};
const nf = (v: number, d = 1) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pctSigned = (v: number | null, d = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(Math.abs(v), d)} %`;
const monthsLabel = (v: number | null) => (v == null ? "—" : `${v} mois`);

/** Libellé de dates d'un épisode (2 lignes possibles côté layout). */
function crisisDatesLabel(r: HistoricalCrisisResult): string {
  if (r.crisis.status === "ongoing") return `depuis ${monthYear(r.effectiveStartDate)}`;
  return `${monthYear(r.effectiveStartDate)} – ${monthYear(r.effectiveEndDate)}`;
}

// ─── Contrôle segmenté (2 options) ───────────────────────────────────────────

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border bg-muted p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "cursor-pointer rounded px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Badge de statut ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HistoricalCrisisResult["crisis"]["status"] }) {
  if (status === "ongoing")
    return (
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
        Épisode en cours
      </span>
    );
  if (status === "provisional")
    return (
      <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        Bornes provisoires
      </span>
    );
  return null;
}

// ─── Tooltip d'un épisode (contenu §15) ──────────────────────────────────────

function CrisisTooltipBody({
  r,
  visibleIds,
  labels,
  measure,
}: {
  r: HistoricalCrisisResult;
  visibleIds: ComparisonStrategyId[];
  labels: Record<ComparisonStrategyId, string>;
  measure: Measure;
}) {
  const byId = new Map(r.strategies.map((s) => [s.strategyId, s]));
  const statusFr =
    r.crisis.status === "ongoing"
      ? "Épisode en cours"
      : r.crisis.status === "provisional"
        ? "Bornes provisoires"
        : null;
  return (
    <div className="space-y-1.5">
      <div>
        <div className="font-semibold">{r.crisis.name}</div>
        <div className="text-[11px] text-muted-foreground">
          {crisisDatesLabel(r)}
          {statusFr ? ` · ${statusFr}` : ""}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[11px]">
        {visibleIds.map((id) => {
          const s = byId.get(id);
          if (!s) return null;
          const v = measure === "performance" ? s.cumulativeReturn : s.maxDrawdown;
          return (
            <Fragment key={id}>
              <span className="text-muted-foreground">{labels[id]}</span>
              <span className="text-right tabular-nums">
                {s.available ? pctSigned(v) : "indisponible"}
              </span>
            </Fragment>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground/70">
        Cliquez le nom de la crise pour le détail complet.
      </div>
    </div>
  );
}

// ─── Panneau de détail (clic/clavier sur le nom) — profondeur quantitative complète ─────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-right text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground/90">{value}</span>
    </>
  );
}

function CrisisDetailPanel({
  r,
  visibleIds,
  labels,
  colors,
}: {
  r: HistoricalCrisisResult;
  visibleIds: ComparisonStrategyId[];
  labels: Record<ComparisonStrategyId, string>;
  colors: Record<ComparisonStrategyId, string>;
}) {
  const byId = new Map(r.strategies.map((s) => [s.strategyId, s]));
  // Repères FACTUELS (§16) sur CETTE crise — mention en gras, aucune recoloration.
  const bestPerf = bestByMetric(r, visibleIds, (s) => s.cumulativeReturn);
  const bestDd = bestByMetric(r, visibleIds, (s) => s.maxDrawdown);

  return (
    <div className="mt-2 space-y-3">
      <p className="text-sm leading-relaxed text-muted-foreground">{r.crisis.definition}</p>
      <p className="text-xs text-muted-foreground">
        Fenêtre analysée : {monthYear(r.effectiveStartDate)} – {monthYear(r.effectiveEndDate)} (
        {r.durationMonths} mois)
      </p>
      {r.crisis.status === "ongoing" && (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
          Résultats provisoires arrêtés au {fullDate(r.effectiveEndDate)}.
        </p>
      )}

      <div className="space-y-2">
        {visibleIds.map((id) => {
          const s = byId.get(id);
          if (!s) return null;
          return (
            <div key={id} className="rounded-md border p-2.5">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span
                  className="inline-block size-2.5 rounded-[2px]"
                  style={{ backgroundColor: colors[id] }}
                />
                {labels[id]}
              </div>
              {s.available ? (
                <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <DetailRow label="Performance" value={pctSigned(s.cumulativeReturn)} />
                  <DetailRow label="Perte maximale" value={pctSigned(s.maxDrawdown)} />
                  <DetailRow label="Sommet" value={s.peakDate ? monthYear(s.peakDate) : "—"} />
                  <DetailRow
                    label="Point bas"
                    value={s.troughDate ? monthYear(s.troughDate) : "—"}
                  />
                  <DetailRow label="Temps jusqu’au creux" value={monthsLabel(s.monthsToTrough)} />
                  <DetailRow
                    label="Retour au sommet"
                    value={
                      s.recovered
                        ? `${monthsLabel(s.recoveryAfterTroughMonths)} après le creux`
                        : "non atteint à ce jour"
                    }
                  />
                  <DetailRow
                    label="Durée totale sous l’eau"
                    value={s.recovered ? monthsLabel(s.underwaterDurationMonths) : "en cours"}
                  />
                </div>
              ) : (
                <div className="mt-1 text-xs italic text-muted-foreground">
                  Indisponible — {s.unavailableReason}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {bestPerf && bestDd && (
        <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-0.5 rounded-md bg-muted/50 p-2.5 text-xs">
          {/* Deux lignes de synthèse : libellé + « : » alignés à droite, valeurs alignées. */}
          <span className="justify-self-end whitespace-nowrap">
            <span className="font-semibold">Performance la plus élevée</span> :
          </span>
          <span>
            {labels[bestPerf.strategyId]}, {pctSigned(bestPerf.cumulativeReturn)}
          </span>
          <span className="justify-self-end whitespace-nowrap">
            <span className="font-semibold">Perte la moins profonde</span> :
          </span>
          <span>
            {labels[bestDd.strategyId]}, {pctSigned(bestDd.maxDrawdown)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Une barre de stratégie ──────────────────────────────────────────────────

function CrisisRow({
  r,
  visibleIds,
  labels,
  colors,
  measure,
  geo,
  ticks,
}: {
  r: HistoricalCrisisResult;
  visibleIds: ComparisonStrategyId[];
  labels: Record<ComparisonStrategyId, string>;
  colors: Record<ComparisonStrategyId, string>;
  measure: Measure;
  geo: { xOf: (v: number) => number; zeroX: number };
  ticks: number[];
}) {
  const { xOf, zeroX } = geo;
  const byId = new Map(r.strategies.map((s) => [s.strategyId, s]));

  // Indisponibilité au NIVEAU CRISE : aucune stratégie visible n'est calculable (la raison
  // reste accessible). On n'affiche alors ni barres ni « 0 % » — jamais un 0 trompeur.
  const { allUnavailable, reason: firstReason } = crisisUnavailability(r, visibleIds);

  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 py-2 sm:grid-cols-[minmax(0,12rem)_1fr]">
      {/* Libellé de crise + panneau de définition */}
      <div className="min-w-0">
        <div className="flex items-start gap-1">
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="min-w-0 cursor-pointer text-left text-sm font-medium leading-tight text-foreground/90 hover:text-foreground hover:underline"
              >
                {r.crisis.name}
              </button>
            </DialogTrigger>
            <FrostedDialogContent showCloseButton className="max-h-[85vh] max-w-lg overflow-y-auto">
              <DialogTitle>{r.crisis.name}</DialogTitle>
              <CrisisDetailPanel r={r} visibleIds={visibleIds} labels={labels} colors={colors} />
            </FrostedDialogContent>
          </Dialog>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{crisisDatesLabel(r)}</span>
          <StatusBadge status={r.crisis.status} />
        </div>
      </div>

      {/* Barres groupées (ou indisponibilité de la crise) */}
      {allUnavailable ? (
        <div className="text-xs text-muted-foreground italic">
          Données indisponibles{firstReason ? ` — ${firstReason}` : ""}
        </div>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative w-full cursor-help select-none">
              {/* Graduations (faibles) + axe zéro (plus marqué) */}
              {ticks.map((t) => (
                <div
                  key={t}
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 w-px",
                    t === 0 ? "bg-foreground/25" : "bg-border/50",
                  )}
                  style={{ left: `${xOf(t)}%` }}
                />
              ))}
              <div className="space-y-1">
                {visibleIds.map((id) => {
                  const s = byId.get(id);
                  const v = s ? strategyValue(s, measure) : null;
                  if (v == null) {
                    return (
                      <div key={id} className="flex h-3.5 items-center">
                        <span className="pl-1 text-[10px] text-muted-foreground/70">
                          indisponible
                        </span>
                      </div>
                    );
                  }
                  const x = Math.max(0, Math.min(100, xOf(v)));
                  const left = Math.min(x, zeroX);
                  const width = Math.abs(x - zeroX);
                  // Étiquette du côté EXTÉRIEUR (opposé au zéro), rabattue vers l'intérieur
                  // (par-dessus la barre) si elle risquait de déborder d'un bord.
                  let labelStyle: CSSProperties;
                  let overBar = false;
                  if (v === 0) {
                    labelStyle =
                      zeroX > 50
                        ? { right: `calc(${100 - zeroX}% + 4px)` }
                        : { left: `calc(${zeroX}% + 4px)` };
                  } else if (v > 0) {
                    if (x > 90) {
                      labelStyle = { right: `calc(${100 - x}% + 4px)` };
                      overBar = true;
                    } else {
                      labelStyle = { left: `calc(${x}% + 4px)` };
                    }
                  } else if (x < 10) {
                    labelStyle = { left: `calc(${x}% + 4px)` };
                    overBar = true;
                  } else {
                    labelStyle = { right: `calc(${100 - x}% + 4px)` };
                  }
                  return (
                    <div key={id} className="relative h-3.5">
                      {/* Fond translucide + bordure fine pleine couleur (même langage que les
                          barres de Vue pays / les aires de drawdown) ; survol → 100 %. */}
                      <div
                        className="absolute inset-y-0 rounded-[2px] border transition-colors hover:[--fp:100%]"
                        style={
                          {
                            left: `${left}%`,
                            width: `${width}%`,
                            borderColor: colors[id],
                            "--fp": "60%",
                            backgroundColor: `color-mix(in srgb, ${colors[id]} var(--fp), transparent)`,
                          } as CSSProperties
                        }
                      />
                      <span
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium tabular-nums",
                          overBar ? "text-white/90" : "text-foreground/80",
                        )}
                        style={labelStyle}
                      >
                        {pctSigned(v)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <CrisisTooltipBody r={r} visibleIds={visibleIds} labels={labels} measure={measure} />
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ─── Axe horizontal (graduations communes à toutes les crises) ───────────────

function Axis({ ticks, xOf }: { ticks: number[]; xOf: (v: number) => number }) {
  return (
    <div className="mt-2 grid grid-cols-[minmax(0,9rem)_1fr] gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
      <div />
      <div className="relative h-6 border-t border-border/50 pt-1.5">
        {ticks.map((t) => {
          const x = xOf(t);
          const transform =
            x <= 2 ? "translateX(0)" : x >= 98 ? "translateX(-100%)" : "translateX(-50%)";
          return (
            <span
              key={t}
              className={cn(
                "absolute top-1.5 whitespace-nowrap text-[11px] tabular-nums",
                t === 0 ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
              style={{ left: `${x}%`, transform }}
            >
              {`${t > 0 ? "+" : t < 0 ? "−" : ""}${nf(Math.abs(t), 0)} %`}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export function HistoricalCrisesSection({
  results,
  visibleIds,
  labels,
  colors,
  window,
}: {
  results: HistoricalCrisisResult[];
  visibleIds: ComparisonStrategyId[];
  labels: Record<ComparisonStrategyId, string>;
  colors: Record<ComparisonStrategyId, string>;
  /** Fenêtre commune (mois « YYYY-MM ») — explique quelles crises sont affichées. */
  window: { start: string; end: string } | null;
}) {
  const [measure, setMeasure] = useState<Measure>("performance");
  const [scope, setScope] = useState<Scope>("primary");

  const shown = useMemo(() => filterByScope(results, scope), [results, scope]);

  // Échelle commune à toutes les barres visibles pour la mesure active.
  const maxAbs = useMemo(
    () => maxAbsValue(shown, visibleIds, measure),
    [shown, visibleIds, measure],
  );

  // Échelle « ronde » + géométrie + graduations, COMMUNES à toutes les crises affichées.
  const scale = useMemo(() => niceScale(maxAbs), [maxAbs]);
  const geo = useMemo(() => geometry(measure, scale.maxTick), [measure, scale.maxTick]);
  const ticks = useMemo(
    () => tickValues(measure, scale.step, scale.maxTick),
    [measure, scale.step, scale.maxTick],
  );

  return (
    <div className="space-y-4">
      {window && (
        <p className="text-xs text-muted-foreground">
          Crises entièrement couvertes par la période commune :{" "}
          <span className="font-medium text-foreground">
            {monthYear(window.start)} – {monthYear(window.end)}
          </span>
          .
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Une stratégie peut terminer une crise en hausse après avoir subi une baisse temporaire,
        visible dans la vue « Perte maximale ».
      </p>

      {/* Détails pédagogiques repliés par défaut (n'encombrent pas l'accès aux résultats). */}
      <Collapsible>
        <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
          Comprendre cette analyse
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Les stratégies sont comparées à l’intérieur des mêmes bornes de dates.</li>
            <li>Les crises ont des durées très différentes.</li>
            <li>Les performances de deux crises ne sont pas directement comparables.</li>
            <li>
              Seules les crises entièrement couvertes par la période sélectionnée sont affichées.
            </li>
            <li>
              La performance finale peut masquer une baisse temporaire au cours de l’épisode
              (visible dans la vue « Perte maximale »).
            </li>
          </ul>
        </CollapsibleContent>
      </Collapsible>

      {/* Contrôles + graphique RAPPROCHÉS ; contrôles alignés sur le bord gauche de la carte. */}
      <div className="space-y-2">
        {/* Sticky pendant la lecture d'une longue liste (aligné au bord gauche de la carte). */}
        <div className="sticky top-[var(--model-header-offset,96px)] z-10 flex flex-wrap items-center gap-x-6 gap-y-2 bg-background/95 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Mesure</span>
            <Segmented<Measure>
              ariaLabel="Mesure"
              value={measure}
              onChange={setMeasure}
              options={[
                { value: "performance", label: "Performance" },
                { value: "drawdown", label: "Perte maximale" },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Périmètre</span>
            <Segmented<Scope>
              ariaLabel="Périmètre"
              value={scope}
              onChange={setScope}
              options={[
                { value: "primary", label: "Crises principales" },
                { value: "all", label: "Toutes les crises" },
              ]}
            />
          </div>
        </div>

        <Card className="gap-0 p-4">
          {/* Légende + rappel de mesure */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {visibleIds.map((id) => (
                <span key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className="inline-block size-2.5 rounded-[2px]"
                    style={{ backgroundColor: colors[id] }}
                  />
                  {labels[id]}
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {measure === "performance"
                ? "Performance cumulée nette de coûts pendant l’épisode"
                : "Perte maximale au sein de l’épisode"}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="cursor-help text-muted-foreground/60 hover:text-foreground"
                  >
                    <Info className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64">
                  <TooltipBody
                    title={
                      measure === "performance"
                        ? "Performance de crise"
                        : "Perte maximale au sein de l’épisode"
                    }
                  >
                    {measure === "performance"
                      ? "Évolution cumulée nette entre le niveau de départ et la fin de l’épisode, non annualisée. Une valeur positive est à droite de l’axe, négative à gauche."
                      : "Perte la plus profonde observée dans la fenêtre de crise, recalculée à partir d’une base 100 au début de l’épisode (ce n’est pas le drawdown global de la stratégie). Une valeur moins négative indique une meilleure limitation de la perte."}
                  </TooltipBody>
                </TooltipContent>
              </Tooltip>
            </span>
          </div>

          {shown.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucune crise entièrement incluse dans la période sélectionnée.
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/50">
                {shown.map((r) => (
                  <CrisisRow
                    key={r.crisis.id}
                    r={r}
                    visibleIds={visibleIds}
                    labels={labels}
                    colors={colors}
                    measure={measure}
                    geo={geo}
                    ticks={ticks}
                  />
                ))}
              </div>
              <Axis ticks={ticks} xOf={geo.xOf} />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

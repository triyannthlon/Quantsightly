"use client";

// « Comportement lors des mois extrêmes des actions » — composant PARTAGÉ par Browne — Vue
// pays ET 4 Quadrants — Vue pays. Il consomme des séries base-100 déclaratives (Actions locales
// + 1-2 modèles), calcule via `computeExtremeMonths` (PUR, testé) et rend. AUCUN calcul de
// stratégie ici. Mono-pays (fiche pays). Rendements nominaux/réels selon le mode, HORS coûts.

import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipBody,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  computeExtremeMonths,
  EXTREME_MONTHS_COUNT,
  type ExtremeMonth,
  type ExtremeSeries,
  type ExtremeSynthesis,
  type ExtremeView,
} from "./extreme-months";

// ─── Formatage ────────────────────────────────────────────────────────────────

// Date d'un point mensuel → notation MM/AAAA, identique au formateur d'axe du graphe historique
// (`formatAxisDate` dans exploration-chart.tsx). Utilisée partout : axe, infobulle, mobile.
const monthYear = (d: string) => {
  const [y, m] = d.split("-");
  return `${m}/${y}`;
};
const nf = (v: number, d = 1) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pctSigned = (v: number | null, d = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(Math.abs(v), d)} %`;
const ptsSigned = (v: number | null, d = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(Math.abs(v), d)} pts`;
const ptsLong = (v: number | null) =>
  v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(Math.abs(v), 1)} points`;
/** Ratio → pourcentage entier (participation aux hausses ; peut > 100 ou < 0). `—` si null. */
const ratioPct = (v: number | null) => (v == null ? "—" : `${nf(v * 100, 0)} %`);
const mean = (xs: number[]): number | null =>
  xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;

// ─── Contrôle segmenté (2 vues) ───────────────────────────────────────────────

function Segmented({
  value,
  onChange,
}: {
  value: ExtremeView;
  onChange: (v: ExtremeView) => void;
}) {
  const opts: { value: ExtremeView; label: string }[] = [
    { value: "worst", label: "Pires mois" },
    { value: "best", label: "Meilleurs mois" },
  ];
  return (
    <div role="group" aria-label="Vue" className="inline-flex rounded-md border bg-muted p-0.5">
      {opts.map((o) => (
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

// ─── Synthèse : trois blocs compacts, AU-DESSUS du graphique ──────────────────

function Tile({
  label,
  value,
  secondary,
  chip,
  tooltip,
}: {
  label: string;
  value: string;
  secondary?: string;
  chip?: string;
  tooltip?: string;
}) {
  // Styles alignés sur les cartes KPI de « Drawdowns successifs » (`DrawdownKpiRow`, la NORME) :
  // même conteneur, même padding, pastille ronde, LIBELLÉ en foreground à la taille de base (pas
  // de `text-muted-foreground`/`text-xs`), valeur `text-sm font-semibold tabular-nums`.
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      {/* Libellé sur hauteur réservée = 2 lignes (`min-h` + `leading-snug`) → la valeur démarre au
          même Y dans les 3 tuiles : baseline commune, que le libellé tienne sur 1 ou 2 lignes. */}
      <div className="flex min-h-[2.75rem] items-start gap-1.5">
        {chip && (
          <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: chip }} />
        )}
        <span className="leading-snug">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="mt-1 shrink-0 cursor-help text-muted-foreground/60 hover:text-foreground"
              >
                <Info className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72">
              <TooltipBody>{tooltip}</TooltipBody>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <div className="mt-2 text-sm font-semibold tabular-nums">{value}</div>
      {secondary && <div className="mt-0.5 text-xs text-muted-foreground">{secondary}</div>}
    </div>
  );
}

function SynthesisTiles({
  view,
  models,
  labels,
  colors,
  synthesis,
  avgEquity,
}: {
  view: ExtremeView;
  models: string[];
  labels: Record<string, string>;
  colors: Record<string, string>;
  synthesis: ExtremeSynthesis[];
  avgEquity: number | null;
}) {
  const byId = new Map(synthesis.map((s) => [s.seriesId, s]));
  return (
    <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
      {/* Ordre modèle → Actions → écart, cohérent avec « Perf cumulée » / « Drawdowns ». */}
      {models.map((id) => {
        const s = byId.get(id);
        return s ? (
          <Tile
            key={`avg-${id}`}
            label={`Rendement moyen — ${labels[id]}`}
            value={pctSigned(view === "worst" ? s.avgDuringWorst : s.avgDuringBest)}
            chip={colors[id]}
          />
        ) : null;
      })}
      <Tile label="Rendement moyen des actions" value={pctSigned(avgEquity)} chip={colors.equity} />
      {models.map((id) => {
        const s = byId.get(id);
        if (!s) return null;
        return view === "worst" ? (
          <Tile
            key={`ecart-${id}`}
            label="Écart moyen vs Actions"
            value={s.evaluatedCount > 0 ? `${ptsLong(s.avgOutperformanceWorst)} par mois` : "—"}
            secondary={
              s.avgDuringWorst != null
                ? `${pctSigned(s.avgDuringWorst)} pour ${labels[id]} contre ${pctSigned(avgEquity)} pour les Actions`
                : undefined
            }
            chip={colors[id]}
            tooltip={
              s.evaluatedCount > 0
                ? `Rendement supérieur à celui des Actions : ${s.betterCount} mois sur ${s.evaluatedCount}`
                : undefined
            }
          />
        ) : (
          <Tile
            key={`part-${id}`}
            label="Part moyenne de la hausse captée"
            value={ratioPct(s.upsideParticipation)}
            secondary={`${pctSigned(s.avgDuringBest)} pour ${labels[id]} contre ${pctSigned(avgEquity)} pour les Actions`}
            chip={colors[id]}
            tooltip="Part de la progression moyenne des Actions captée par le modèle pendant les 12 meilleurs mois des Actions. Une valeur de 100 % signifie que le modèle a progressé autant que les Actions en moyenne."
          />
        );
      })}
    </div>
  );
}

// ─── Graphique : une ligne par mois, barres groupées, axe zéro au centre ───────

function geometry(maxAbs: number) {
  const bound = (maxAbs || 1) * 1.15; // marge pour les étiquettes
  const xOf = (v: number) => ((v + bound) / (2 * bound)) * 100;
  return { xOf, zeroX: 50 };
}

function MonthRow({
  m,
  seriesOrder,
  colors,
  xOf,
  zeroX,
}: {
  m: ExtremeMonth;
  seriesOrder: string[];
  colors: Record<string, string>;
  xOf: (v: number) => number;
  zeroX: number;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 py-1.5">
      <div className="text-xs font-medium text-muted-foreground">{monthYear(m.date)}</div>
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-y-0 w-px bg-foreground/25"
          style={{ left: "50%" }}
        />
        <div className="space-y-0.5">
          {seriesOrder.map((id) => {
            const v = m.returns[id];
            if (v == null) return <div key={id} className="h-3" />;
            const x = Math.max(0, Math.min(100, xOf(v)));
            const left = Math.min(x, zeroX);
            const width = Math.abs(x - zeroX);
            const labelStyle: CSSProperties =
              v >= 0 ? { left: `calc(${x}% + 4px)` } : { right: `calc(${100 - x}% + 4px)` };
            return (
              <div key={id} className="relative h-3">
                <div
                  className="absolute inset-y-0 rounded-[2px]"
                  style={{ left: `${left}%`, width: `${width}%`, backgroundColor: colors[id] }}
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] tabular-nums text-foreground/80"
                  style={labelStyle}
                >
                  {pctSigned(v)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Graphique (desktop) : colonnes verticales groupées ──────────────────────

/** Hauteur du graphe desktop (px) — sert aussi à décider si une étiquette tient dans la barre. */
const CHART_H = 280;

function VerticalChart({
  months,
  seriesOrder,
  equityId,
  models,
  labels,
  colors,
}: {
  months: ExtremeMonth[];
  seriesOrder: string[];
  equityId: string;
  models: string[];
  labels: Record<string, string>;
  colors: Record<string, string>;
}) {
  // Domaine vertical incluant 0 (une vue = mois tous du même signe côté actions, mais le
  // modèle peut aller à contre-sens → on borne par les valeurs réelles des deux séries).
  let minV = 0;
  let maxV = 0;
  for (const m of months)
    for (const id of seriesOrder) {
      const v = m.returns[id];
      if (v != null) {
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
      }
    }
  const pad = (maxV - minV || 1) * 0.14; // marge haut/bas pour les étiquettes hors barres
  const lo = minV - pad;
  const hi = maxV + pad;
  const yOf = (v: number) => ((hi - v) / (hi - lo)) * 100; // % depuis le haut
  const y0 = yOf(0);

  return (
    <div className="@container/xmonths">
      <div className="relative" style={{ height: CHART_H }}>
        {/* Ligne du 0 % */}
        <div
          aria-hidden
          className="absolute inset-x-0 h-px bg-foreground/30"
          style={{ top: `${y0}%` }}
        />
        <div className="absolute inset-0 flex">
          {months.map((m, mi) => {
            // Anti-collision des étiquettes d'un même mois : si les deux valeurs sont du même côté
            // (au-dessus / en dessous) et à des hauteurs trop proches, on repousse celle du modèle
            // vers l'extérieur d'une ligne pour qu'elles se lisent l'une au-dessus de l'autre —
            // jamais de superposition. (Les collisions entre mois voisins n'apparaissent qu'en
            // dessous du seuil `@[520px]`, où les étiquettes sont de toute façon masquées.)
            const LABEL_H = 13; // hauteur approx d'une étiquette (px)
            const ends = seriesOrder.map((id) => {
              const v = m.returns[id];
              return v == null ? null : { positive: v >= 0, endPct: yOf(v) };
            });
            const labelOffset = seriesOrder.map(() => 0);
            const [e0, e1] = ends;
            if (e0 && e1 && e0.positive === e1.positive) {
              const gapPx = (Math.abs(e0.endPct - e1.endPct) / 100) * CHART_H;
              if (gapPx < LABEL_H + 3) labelOffset[1] = LABEL_H + 3;
            }
            return (
              <Tooltip key={m.date}>
                <div className="flex h-full flex-1 justify-center">
                  <TooltipTrigger asChild>
                    <div className="relative flex h-full cursor-help items-stretch gap-[7px]">
                      {seriesOrder.map((id, i) => {
                        const v = m.returns[id];
                        if (v == null) return <div key={id} className="w-4 lg:w-[18px] xl:w-5" />;
                        const positive = v >= 0;
                        const yTop = yOf(Math.max(v, 0));
                        const yBot = yOf(Math.min(v, 0));
                        const heightPct = Math.max(yBot - yTop, 0.5);
                        // Remplissage semi-transparent + bordure fine pleine couleur (langage des
                        // drawdowns), mais moins transparent qu'une zone de drawdown (marques discrètes
                        // à garder lisibles) : Actions ~0,50, modèle ~0,60. `--fp` passe à 100 % au
                        // survol de LA barre exacte (`hover`) ; bordure = couleur pleine (opacité 1).
                        const fillPct = id === equityId ? 50 : 60;
                        // Étiquette HORIZONTALE, à l'extérieur de la barre : au-dessus de l'extrémité
                        // haute si positif, sous l'extrémité basse si négatif. Décalée horizontalement
                        // vers l'EXTÉRIEUR de sa barre (colonne de gauche ← / droite →) pour que chaque
                        // valeur s'associe sans ambiguïté à sa série. `labelOffset` ajoute un décalage
                        // vertical si les deux valeurs d'un mois sont trop proches (cf. calcul par mois).
                        // Masquée si le conteneur est trop étroit (@container) ; tooltip = référence.
                        const out = 3 + labelOffset[i];
                        const dx = i === 0 ? -6 : 6;
                        const labelStyle: CSSProperties = positive
                          ? { bottom: `calc(${100 - yTop}% + ${out}px)` }
                          : { top: `calc(${yBot}% + ${out}px)` };
                        return (
                          <div key={id} className="relative w-4 lg:w-[18px] xl:w-5">
                            <div
                              className="absolute inset-x-0 rounded-[1px] border transition-colors hover:[--fp:100%]"
                              style={
                                {
                                  top: `${yTop}%`,
                                  height: `${heightPct}%`,
                                  borderColor: colors[id],
                                  "--fp": `${fillPct}%`,
                                  backgroundColor: `color-mix(in srgb, ${colors[id]} var(--fp), transparent)`,
                                } as CSSProperties
                              }
                            />
                            <span
                              className="pointer-events-none absolute left-1/2 z-10 hidden text-[10px] leading-none font-medium whitespace-nowrap tabular-nums @[520px]/xmonths:block"
                              style={{
                                ...labelStyle,
                                color: colors[id],
                                transform: `translateX(calc(-50% + ${dx}px))`,
                              }}
                            >
                              {pctSigned(v)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </TooltipTrigger>
                </div>
                {/* Trigger = groupe de barres (pas toute la colonne `flex-1`) → l'infobulle s'ancre
                  juste à côté des barres, pas au bord de la colonne. Placement latéral, centré
                  verticalement (une infobulle « top » flotterait par-dessus les KPI vu la hauteur du
                  trigger), pointant vers l'intérieur pour ne jamais sortir de la carte. */}
                <TooltipContent
                  side={mi < months.length / 2 ? "right" : "left"}
                  align="center"
                  collisionPadding={12}
                  className="max-w-56"
                >
                  <TooltipBody title={monthYear(m.date)}>
                    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-[11px]">
                      <span>{labels[equityId]}</span>
                      <span className="tabular-nums">{pctSigned(m.returns[equityId])}</span>
                      {models.map((id) => {
                        const mv = m.returns[id];
                        const ev = m.returns[equityId];
                        const diff = mv != null && ev != null ? mv - ev : null;
                        return (
                          <Fragment key={id}>
                            <span>{labels[id]}</span>
                            <span className="tabular-nums">{pctSigned(mv)}</span>
                            <span className="text-muted-foreground">Écart</span>
                            <span className="tabular-nums text-muted-foreground">
                              {ptsSigned(diff)}
                            </span>
                          </Fragment>
                        );
                      })}
                    </div>
                  </TooltipBody>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
      {/* Axe X : dates courtes inclinées à −45°. */}
      <div className="mt-1 flex h-10">
        {months.map((m) => (
          <div key={m.date} className="flex flex-1 justify-center overflow-visible">
            <span className="origin-top-right -rotate-45 text-[11px] whitespace-nowrap text-muted-foreground">
              {monthYear(m.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Carte ────────────────────────────────────────────────────────────────────

export function ExtremeMonthsCard({
  series,
  colors,
}: {
  series: ExtremeSeries[];
  /** Couleur par id de série (Actions + modèle(s)). */
  colors: Record<string, string>;
}) {
  const [view, setView] = useState<ExtremeView>("worst");
  const result = useMemo(() => computeExtremeMonths(series), [series]);

  const equity = series.find((s) => s.isEquity);
  const models = series.filter((s) => !s.isEquity).map((s) => s.id);
  const seriesOrder = series.map((s) => s.id); // Actions d'abord, puis modèle(s)
  const labels = Object.fromEntries(series.map((s) => [s.id, s.label]));
  const equityId = equity?.id ?? "equity";

  const months = view === "worst" ? result.worst : result.best;
  const avgEquity = months.length ? mean(months.map((m) => m.equityReturn)) : null;

  const maxAbs = useMemo(() => {
    let m = 0;
    for (const mth of [...result.worst, ...result.best]) {
      for (const v of Object.values(mth.returns)) if (v != null) m = Math.max(m, Math.abs(v));
    }
    return m || 1;
  }, [result]);
  const { xOf, zeroX } = geometry(maxAbs);

  const hasData = !!equity && months.length > 0;

  return (
    <TooltipProvider delayDuration={150}>
      <Card id="extremes" className="scroll-mt-[var(--model-header-offset,96px)] gap-0 p-4">
        {/* En-tête */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">
              Comportement lors des mois extrêmes des actions
            </h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="cursor-help text-muted-foreground/60 hover:text-foreground"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-72">
                <TooltipBody title="Mois extrêmes des actions">
                  Les {EXTREME_MONTHS_COUNT} pires et {EXTREME_MONTHS_COUNT} meilleurs mois sont
                  identifiés sur les ACTIONS LOCALES, puis exactement ces dates sont appliquées au
                  modèle. Rendements hors coûts de transaction.
                </TooltipBody>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-sm text-muted-foreground">
            Rendements du modèle pendant les {EXTREME_MONTHS_COUNT} meilleurs et les{" "}
            {EXTREME_MONTHS_COUNT} pires mois des actions locales.
          </p>
          <p className="text-xs text-muted-foreground">
            Résultats nominaux ou réels selon le mode sélectionné, hors coûts de transaction.
          </p>
        </div>

        {/* Bascule de vue + légende */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Segmented value={view} onChange={setView} />
          <div className="flex flex-wrap items-center gap-3">
            {seriesOrder.map((id) => (
              <span key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block size-2.5 rounded-[2px]"
                  style={{ backgroundColor: colors[id] }}
                />
                {labels[id]}
              </span>
            ))}
          </div>
        </div>

        {!hasData ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Historique actions insuffisant sur la fenêtre sélectionnée.
          </div>
        ) : (
          <>
            {/* Synthèse (3 blocs compacts) — AU-DESSUS du graphique. */}
            <SynthesisTiles
              view={view}
              models={models}
              labels={labels}
              colors={colors}
              synthesis={result.synthesis}
              avgEquity={avgEquity}
            />

            {/* Desktop / grande tablette : colonnes verticales groupées. */}
            <div className="mt-3 hidden md:block">
              <VerticalChart
                months={months}
                seriesOrder={seriesOrder}
                equityId={equityId}
                models={models}
                labels={labels}
                colors={colors}
              />
            </div>
            {/* Mobile : barres horizontales (plus lisibles en étroit). */}
            <div className="mt-3 divide-y divide-border/50 md:hidden">
              {months.map((m) => (
                <MonthRow
                  key={m.date}
                  m={m}
                  seriesOrder={seriesOrder}
                  colors={colors}
                  xOf={xOf}
                  zeroX={zeroX}
                />
              ))}
            </div>
            {months.length < EXTREME_MONTHS_COUNT && (
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                Fenêtre courte : {months.length} mois affichés (moins de {EXTREME_MONTHS_COUNT}).
              </p>
            )}
          </>
        )}
      </Card>
    </TooltipProvider>
  );
}

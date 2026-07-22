// Pas de directive client en tête ici : ce composant est importé uniquement par
// quadrants-view.tsx (qui EST la frontière cliente), il est donc compilé côté client
// via son parent. Une directive redondante créerait une frontière imbriquée.

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ExplorationChart, type ChartLine } from "@/app/(admin)/exploration/exploration-chart";
import { mergeChart, SLEEVE_META } from "./helpers";
// ⚠️ Sous-modules PURS uniquement (types + constantes) : ce composant CLIENT ne doit
// PAS tirer le moteur `model-comparison` ni `browne.ts` dans le bundle client.
import type {
  Allocation,
  ComparisonStrategyId,
  ComparisonStrategyResult,
  ComparisonMetrics,
  ModelComparisonResult,
} from "@/lib/coredata/model-comparison/types";
import { UNAVAILABLE_REASON_FR } from "@/lib/coredata/model-comparison/types";
import { ROLLING_WINDOWS_YEARS } from "@/lib/coredata/model-comparison/constants";

// Filtre d'AFFICHAGE (n'altère jamais les calculs — cf. §6).
export type ComparisonFilter = "all" | "dyn_browne" | "bin_browne" | "dyn_bin";

const FILTER_IDS: Record<ComparisonFilter, ComparisonStrategyId[]> = {
  all: ["browne", "quadrants-dynamic-v2", "quadrants-binary-v2"],
  dyn_browne: ["browne", "quadrants-dynamic-v2"],
  bin_browne: ["browne", "quadrants-binary-v2"],
  dyn_bin: ["quadrants-dynamic-v2", "quadrants-binary-v2"],
};

/** Question éditoriale propre à chaque paire (§10). */
const PAIR_QUESTION: Record<Exclude<ComparisonFilter, "all">, string> = {
  dyn_browne:
    "L’adaptation continue au régime macroéconomique apporte-t-elle un avantage par rapport à une allocation permanente ?",
  bin_browne:
    "Une allocation plus concentrée par régime améliore-t-elle suffisamment la performance pour compenser ses changements plus marqués ?",
  dyn_bin: "La continuité de l’allocation est-elle préférable à une sélection plus tranchée des actifs ?",
};

const STRATEGY_COLOR: Record<ComparisonStrategyId, string> = {
  browne: "#6C93C7", // bleu
  "quadrants-dynamic-v2": "#E8833A", // orange (accent produit)
  "quadrants-binary-v2": "#4FB6A0", // sarcelle
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const nf = (v: number, d = 1) =>
  v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v: number | null, d = 1) => (v === null ? "—" : `${nf(v, d)} %`);
const ratio = (v: number | null, d = 2) => (v === null ? "—" : nf(v, d));
const months = (v: number | null) => (v === null ? "—" : `${Math.round(v)} mois`);
const perYear = (v: number | null, d = 1) => (v === null ? "—" : `${nf(v, d)}/an`);
const signed = (v: number, unit: string, d = 1) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${nf(Math.abs(v), d)} ${unit}`;

// ─── Définition des lignes de métriques ───────────────────────────────────────

type MetricKey = keyof ComparisonMetrics;

interface MetricRow {
  key: MetricKey;
  label: string;
  fmt: (v: number | null) => string;
  higherBetter: boolean;
  /** Formatte l'écart (déjà en unité de la métrique). */
  diff: (d: number) => string;
  tip: string;
}

const ROW: Record<string, MetricRow> = {
  annualized: { key: "annualized", label: "Performance annualisée", fmt: (v) => pct(v), higherBetter: true, diff: (d) => signed(d, "pt"), tip: "Rendement annualisé géométrique (CAGR) net de coûts sur la période." },
  volatility: { key: "volatility", label: "Volatilité annualisée", fmt: (v) => pct(v), higherBetter: false, diff: (d) => signed(d, "pt"), tip: "Amplitude générale des variations mensuelles, annualisée." },
  sharpe: { key: "sharpe", label: "Sharpe", fmt: (v) => ratio(v), higherBetter: true, diff: (d) => signed(d, "", 2), tip: "Excédent de rendement sur le cash local, rapporté à la volatilité. Un critère parmi d’autres." },
  sortino: { key: "sortino", label: "Sortino", fmt: (v) => ratio(v), higherBetter: true, diff: (d) => signed(d, "", 2), tip: "Rendement rapporté à la seule volatilité baissière (pertes)." },
  maxDrawdown: { key: "maxDrawdown", label: "Max drawdown", fmt: (v) => pct(v), higherBetter: true, diff: (d) => signed(d, "pt"), tip: "Pire perte du pic au creux sur la période." },
  maxUnderwaterMonths: { key: "maxUnderwaterMonths", label: "Durée max sous l’eau", fmt: (v) => months(v), higherBetter: false, diff: (d) => signed(d, "mois", 0), tip: "Plus longue période passée sous un sommet avant d’y revenir." },
  worstRolling12m: { key: "worstRolling12m", label: "Pire 12 mois glissants", fmt: (v) => pct(v), higherBetter: true, diff: (d) => signed(d, "pt"), tip: "Pire performance observée sur une fenêtre de 12 mois consécutifs." },
  annualizedTurnover: { key: "annualizedTurnover", label: "Rotation annualisée", fmt: (v) => pct(v === null ? null : v * 100), higherBetter: false, diff: (d) => signed(d * 100, "pt"), tip: "Part du portefeuille échangée en moyenne par an (transactions exécutées)." },
  reallocationsPerYear: { key: "reallocationsPerYear", label: "Fréquence de réallocation", fmt: (v) => perYear(v), higherBetter: false, diff: (d) => signed(d, "/an"), tip: "Nombre moyen de mois par an où le portefeuille est effectivement réajusté." },
  cumulativeCost: { key: "cumulativeCost", label: "Coûts cumulés", fmt: (v) => pct(v, 2), higherBetter: false, diff: (d) => signed(d, "pt", 2), tip: "Coûts de transaction cumulés sur la période, sous l’hypothèse de coûts retenue." },
  worstMonth: { key: "worstMonth", label: "Pire mois", fmt: (v) => pct(v), higherBetter: true, diff: (d) => signed(d, "pt"), tip: "Pire rendement mensuel observé." },
  worstQuarter: { key: "worstQuarter", label: "Pire trimestre", fmt: (v) => pct(v), higherBetter: true, diff: (d) => signed(d, "pt"), tip: "Pire rendement sur 3 mois consécutifs." },
  expectedShortfall95: { key: "expectedShortfall95", label: "Expected Shortfall 95 %", fmt: (v) => pct(v), higherBetter: true, diff: (d) => signed(d, "pt"), tip: "Perte moyenne des 5 % de pires mois (sans hypothèse de loi normale)." },
  expectedShortfall99: { key: "expectedShortfall99", label: "Expected Shortfall 99 %", fmt: (v) => pct(v), higherBetter: true, diff: (d) => signed(d, "pt"), tip: "Perte moyenne des 1 % de pires mois." },
  downsideDeviation: { key: "downsideDeviation", label: "Downside deviation", fmt: (v) => pct(v), higherBetter: false, diff: (d) => signed(d, "pt"), tip: "Volatilité des seuls rendements négatifs, annualisée." },
  skewness: { key: "skewness", label: "Asymétrie (skewness)", fmt: (v) => ratio(v), higherBetter: true, diff: (d) => signed(d, "", 2), tip: "Asymétrie des rendements : négative = pertes plus marquées." },
  excessKurtosis: { key: "excessKurtosis", label: "Kurtosis excédentaire", fmt: (v) => ratio(v), higherBetter: false, diff: (d) => signed(d, "", 2), tip: "Épaisseur des queues : plus élevé = événements extrêmes plus fréquents." },
  annualCostEstimate: { key: "annualCostEstimate", label: "Coûts annualisés estimés", fmt: (v) => pct(v, 2), higherBetter: false, diff: (d) => signed(d, "pt", 2), tip: "Coût de transaction moyen par an sous l’hypothèse retenue." },
};

// ─── Primitives d'affichage ───────────────────────────────────────────────────

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-[var(--model-header-offset,96px)] space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-3 py-2 text-left font-medium text-muted-foreground", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 tabular-nums", className)}>{children}</td>;
}

/** Pastille de couleur + libellé de stratégie. */
function StrategyChip({ s }: { s: ComparisonStrategyResult }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: STRATEGY_COLOR[s.id] }} />
      {s.label}
    </span>
  );
}

/** Ton (favorable / défavorable / neutre) d'un écart selon le sens de la métrique. */
function diffTone(d: number, higherBetter: boolean): string {
  if (Math.abs(d) < 1e-9) return "text-muted-foreground";
  const good = higherBetter ? d > 0 : d < 0;
  return good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
}

// ─── Tableau de métriques (une colonne par stratégie + écart vs Browne) ────────

function MetricTable({
  rows,
  strategies,
  browne,
}: {
  rows: MetricRow[];
  strategies: ComparisonStrategyResult[];
  browne: ComparisonStrategyResult | null;
}) {
  const showDiff = !!browne && strategies.some((s) => s.id !== "browne");
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="border-b bg-muted/40">
          <tr>
            <Th className="sticky left-0 bg-muted/40">Indicateur</Th>
            {strategies.map((s) => (
              <Th key={s.id} className="text-right">
                <span className="flex justify-end">
                  <StrategyChip s={s} />
                </span>
              </Th>
            ))}
            {showDiff && <Th className="text-right">Écart vs Browne</Th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const bval = browne?.metrics ? (browne.metrics[r.key] as number | null) : null;
            // Écart affiché : la 1ʳᵉ stratégie non-Browne visible (paires) ou omis en « toutes ».
            const other = strategies.find((s) => s.id !== "browne");
            const oval = other?.metrics ? (other.metrics[r.key] as number | null) : null;
            const canDiff = showDiff && bval !== null && oval !== null && strategies.length === 2;
            return (
              <tr key={r.key} className="border-b last:border-0">
                <Td className="sticky left-0 bg-background font-medium" >
                  <span title={r.tip} className="cursor-help decoration-dotted underline-offset-2 hover:underline">
                    {r.label}
                  </span>
                </Td>
                {strategies.map((s) => (
                  <Td key={s.id} className="text-right">
                    {r.fmt(s.metrics ? (s.metrics[r.key] as number | null) : null)}
                  </Td>
                ))}
                {showDiff && (
                  <Td className={cn("text-right", canDiff ? diffTone(oval! - bval!, r.higherBetter) : "text-muted-foreground")}>
                    {canDiff ? r.diff(oval! - bval!) : "—"}
                  </Td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Blocs ────────────────────────────────────────────────────────────────────

/** Bloc 1 — synthèse comparative en 4 dimensions (sans verdict absolu). */
function SynthesisCards({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const withM = strategies.filter((s) => s.metrics);
  if (withM.length < 2) return null;
  const leaderBy = (pick: (m: ComparisonMetrics) => number | null, higher = true) =>
    withM.reduce<{ s: ComparisonStrategyResult; v: number } | null>((best, s) => {
      const v = pick(s.metrics!);
      if (v === null) return best;
      if (!best) return { s, v };
      return (higher ? v > best.v : v < best.v) ? { s, v } : best;
    }, null);

  const perf = leaderBy((m) => m.annualized, true);
  const prot = leaderBy((m) => m.maxDrawdown, true); // le moins négatif protège le mieux
  const reg = leaderBy((m) => m.sharpe, true);
  const cost = leaderBy((m) => m.annualizedTurnover, false);

  const cards = [
    perf && { title: "Performance", body: `${perf.s.label} délivre la meilleure performance annualisée sur la période (${pct(perf.v)}).` },
    prot && { title: "Protection", body: `${prot.s.label} limite le mieux les pertes maximales (max drawdown ${pct(prot.v)}).` },
    reg && { title: "Régularité", body: `${reg.s.label} présente le meilleur rapport rendement/risque (Sharpe ${ratio(reg.v)}).` },
    cost && { title: "Coût de gestion", body: `${cost.s.label} présente la rotation la plus faible (${pct(cost.v * 100)}/an), donc les coûts les plus bas.` },
  ].filter(Boolean) as { title: string; body: string }[];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title} className="gap-1.5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{c.title}</p>
          <p className="text-sm text-muted-foreground">{c.body}</p>
        </Card>
      ))}
    </div>
  );
}

/** Bloc 2 — performance cumulée nette (base 100), légende masquable. */
function CumulativeChart({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const [hidden, setHidden] = useState<Set<ComparisonStrategyId>>(new Set());
  const visible = strategies.filter((s) => s.metrics && !hidden.has(s.id));
  const data = useMemo(
    () => mergeChart(visible.map((s) => ({ key: s.id, data: s.cumulativeSeries }))),
    [visible],
  );
  const lines: ChartLine[] = visible.map((s) => ({
    key: s.id,
    label: s.label,
    color: STRATEGY_COLOR[s.id],
    width: s.id === "browne" ? 2 : 2.4,
  }));

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {strategies
          .filter((s) => s.metrics)
          .map((s) => {
            const off = hidden.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() =>
                  setHidden((h) => {
                    const n = new Set(h);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })
                }
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 text-sm transition-opacity",
                  off && "opacity-40",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ background: STRATEGY_COLOR[s.id] }} />
                {s.label}
              </button>
            );
          })}
      </div>
      {data.length >= 2 ? (
        <ExplorationChart data={data} lines={lines} height={360} cumulativeTooltip markLast />
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">Sélectionnez au moins une série.</p>
      )}
    </Card>
  );
}

/** Bloc 4 — drawdowns comparés sur la même chronologie. */
function DrawdownChart({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const visible = strategies.filter((s) => s.metrics);
  const data = useMemo(
    () => mergeChart(visible.map((s) => ({ key: s.id, data: s.drawdownSeries }))),
    [visible],
  );
  const lines: ChartLine[] = visible.map((s) => ({
    key: s.id,
    label: s.label,
    color: STRATEGY_COLOR[s.id],
    fillOpacity: 0.08,
  }));
  return (
    <Card className="gap-3 p-4">
      <ExplorationChart data={data} lines={lines} height={300} areaFill percentTooltip yDomain={undefined} />
      <MetricTable
        rows={[ROW.maxDrawdown, ROW.maxUnderwaterMonths, ROW.worstRolling12m]}
        strategies={strategies}
        browne={strategies.find((s) => s.id === "browne") ?? null}
      />
    </Card>
  );
}

/** Bloc 5 — performances annualisées glissantes (5/10/15 ans). */
function RollingSection({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const withM = strategies.filter((s) => s.metrics);
  return (
    <div className="space-y-4">
      {ROLLING_WINDOWS_YEARS.map((years) => {
        const anyData = withM.some((s) => (s.metrics!.rolling.find((r) => r.windowYears === years)?.count ?? 0) > 0);
        if (!anyData) return null;
        return (
          <div key={years} className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <Th>Fenêtres {years} ans</Th>
                  <Th className="text-right">Médiane</Th>
                  <Th className="text-right">Pire</Th>
                  <Th className="text-right">Meilleure</Th>
                  <Th className="text-right">% devant Browne</Th>
                  <Th className="text-right"># fenêtres</Th>
                </tr>
              </thead>
              <tbody>
                {withM.map((s) => {
                  const r = s.metrics!.rolling.find((x) => x.windowYears === years);
                  if (!r || r.count === 0)
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <Td><StrategyChip s={s} /></Td>
                        <Td className="text-right text-muted-foreground" >—</Td>
                        <Td className="text-right text-muted-foreground">—</Td>
                        <Td className="text-right text-muted-foreground">—</Td>
                        <Td className="text-right text-muted-foreground">—</Td>
                        <Td className="text-right text-muted-foreground">0</Td>
                      </tr>
                    );
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <Td><StrategyChip s={s} /></Td>
                      <Td className="text-right">{pct(r.median)}</Td>
                      <Td className="text-right">{pct(r.worst)}</Td>
                      <Td className="text-right">{pct(r.best)}</Td>
                      <Td className="text-right">
                        {s.id === "browne" || r.shareBeatingBrowne === null ? "—" : pct(r.shareBeatingBrowne * 100, 0)}
                      </Td>
                      <Td className="text-right text-muted-foreground">{r.count}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/** Bloc 7 — rotation, coûts, écart brut/net. */
function CostSection({
  strategies,
  gross,
}: {
  strategies: ComparisonStrategyResult[];
  gross: Map<ComparisonStrategyId, number | null>;
}) {
  return (
    <div className="space-y-3">
      <MetricTable
        rows={[ROW.annualizedTurnover, ROW.reallocationsPerYear, ROW.annualCostEstimate, ROW.cumulativeCost]}
        strategies={strategies}
        browne={strategies.find((s) => s.id === "browne") ?? null}
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[420px] text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <Th>Écart brut − net (coût de gestion sur la performance)</Th>
              {strategies.map((s) => (
                <Th key={s.id} className="text-right">
                  <span className="flex justify-end"><StrategyChip s={s} /></span>
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td className="font-medium">Coût cumulé en performance</Td>
              {strategies.map((s) => {
                const g = gross.get(s.id);
                const net = s.metrics?.cumulative ?? null;
                const drag = g !== null && g !== undefined && net !== null ? g - net : null;
                return (
                  <Td key={s.id} className="text-right text-muted-foreground">
                    {drag === null ? "—" : `−${nf(drag, 1)} pt`}
                  </Td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Browne : rééquilibrage annuel (rotation faible). Le 4 Quadrants adapte l’allocation aux régimes,
        mais la bande de réallocation limite les transactions : seules les transactions réellement
        exécutées sont comptées, jamais les changements de cible non exécutés.
      </p>
    </div>
  );
}

/** Bloc 8 — allocations réellement détenues (cible en secondaire si différente). */
function AllocationSection({ strategies }: { strategies: ComparisonStrategyResult[] }) {
  const keys = ["equities", "bonds", "gold", "cash"] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {strategies
        .filter((s) => s.currentAllocation)
        .map((s) => {
          const held = s.currentAllocation!;
          const target = s.targetAllocation;
          return (
            <Card key={s.id} className="gap-2.5 p-4">
              <StrategyChip s={s} />
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Allocation actuelle du modèle</p>
                <AllocBar alloc={held} />
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {keys.map((k) => (
                    <span key={k} className="tabular-nums">
                      <span className="mr-1 inline-block size-2 rounded-full align-middle" style={{ background: SLEEVE_META[k].hex }} />
                      {SLEEVE_META[k].label} {Math.round((held[k] ?? 0) * 100)} %
                    </span>
                  ))}
                </div>
              </div>
              {target && (
                <div className="border-t pt-2">
                  <p className="mb-1 text-xs text-muted-foreground">Allocation cible</p>
                  <AllocBar alloc={target} muted />
                </div>
              )}
            </Card>
          );
        })}
    </div>
  );
}

function AllocBar({ alloc, muted }: { alloc: Allocation; muted?: boolean }) {
  const keys = ["equities", "bonds", "gold", "cash"] as const;
  return (
    <div className={cn("flex h-3.5 w-full overflow-hidden rounded", muted && "opacity-55")}>
      {keys.map((k) => {
        const w = (alloc[k] ?? 0) * 100;
        if (w <= 0) return null;
        return <div key={k} style={{ width: `${w}%`, background: SLEEVE_META[k].hex }} title={`${SLEEVE_META[k].label} ${Math.round(w)} %`} />;
      })}
    </div>
  );
}

/** Bloc 9 — lecture pédagogique + questions par paire. */
function PedagogySection({
  strategies,
  filter,
}: {
  strategies: ComparisonStrategyResult[];
  filter: ComparisonFilter;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {strategies.map((s) => (
          <Card key={s.id} className="gap-1.5 p-4">
            <StrategyChip s={s} />
            <p className="text-sm text-muted-foreground">{s.description}</p>
          </Card>
        ))}
      </div>
      {filter !== "all" && (
        <Card className="gap-1 border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">La question de cette comparaison</p>
          <p className="text-sm">{PAIR_QUESTION[filter]}</p>
        </Card>
      )}
      <p className="text-sm text-muted-foreground">
        Browne privilégie la stabilité de la structure. Les modèles 4 Quadrants cherchent à adapter
        l’allocation au contexte macroéconomique. La comparaison doit porter à la fois sur la performance,
        le risque, les pertes et le coût des ajustements.
      </p>
    </div>
  );
}

// ─── Vue principale ────────────────────────────────────────────────────────────

export function QuadrantsVsBrowneView({
  result,
  grossResult,
  filter,
  costBps,
}: {
  result: ModelComparisonResult;
  grossResult: ModelComparisonResult;
  filter: ComparisonFilter;
  costBps: number;
}) {
  const visibleIds = FILTER_IDS[filter];
  const strategies = visibleIds
    .map((id) => result.strategies.find((s) => s.id === id))
    .filter((s): s is ComparisonStrategyResult => !!s);
  const browne = strategies.find((s) => s.id === "browne") ?? null;
  const available = strategies.filter((s) => s.availability.status === "ok");

  const grossById = useMemo(
    () =>
      new Map<ComparisonStrategyId, number | null>(
        grossResult.strategies.map((s) => [s.id, s.metrics?.cumulative ?? null]),
      ),
    [grossResult],
  );

  // Indisponibilités explicites.
  const unavailable = strategies.filter((s) => s.availability.status === "unavailable");

  if (available.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Comparaison indisponible
        {result.disabledReason ? ` — ${UNAVAILABLE_REASON_FR[result.disabledReason]}` : ""}.
      </Card>
    );
  }

  const w = result.window;
  const modeLabel = result.mode === "real" ? "réelle" : "nominale";

  return (
    <div className="space-y-8">
      {/* Bandeau fenêtre + hypothèses */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {w && (
          <span>
            Fenêtre commune : <span className="font-medium text-foreground">{w.start} → {w.end}</span> ({w.months} mois)
          </span>
        )}
        <span>Performance {modeLabel}, nette de coûts ({costBps} bps)</span>
        <span>Résultats exprimés dans la devise locale du pays</span>
      </div>

      {unavailable.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {unavailable.map((s) => (
            <div key={s.id}>
              {s.label} indisponible
              {s.availability.status === "unavailable" ? ` — ${UNAVAILABLE_REASON_FR[s.availability.reason]}` : ""}.
            </div>
          ))}
        </div>
      )}

      <Section id="synthese" title="Lecture synthétique" subtitle="Quatre dimensions, sans classement absolu — chaque modèle répond à une logique différente.">
        <SynthesisCards strategies={available} />
      </Section>

      <Section id="performance" title="Performance cumulée nette de coûts" subtitle="Base 100 au début de la fenêtre commune. Cliquez une série de la légende pour la masquer.">
        <CumulativeChart strategies={available} />
      </Section>

      <Section id="indicateurs" title="Indicateurs comparatifs" subtitle="Une valeur élevée n’est pas toujours favorable : volatilité, rotation et drawdown plus élevés sont défavorables.">
        <MetricTable
          rows={[ROW.annualized, ROW.volatility, ROW.sharpe, ROW.sortino, ROW.maxDrawdown, ROW.maxUnderwaterMonths, ROW.worstRolling12m, ROW.annualizedTurnover, ROW.reallocationsPerYear, ROW.cumulativeCost]}
          strategies={available}
          browne={browne}
        />
      </Section>

      <Section id="drawdowns" title="Drawdowns" subtitle="Pertes depuis le dernier sommet, sur la même chronologie.">
        <DrawdownChart strategies={available} />
      </Section>

      <Section id="glissante" title="Performance glissante" subtitle="Une stratégie domine-t-elle seulement sur la période totale, ou aussi sur des fenêtres intermédiaires ?">
        <RollingSection strategies={available} />
      </Section>

      <Section id="risque-baisse" title="Risque de baisse" subtitle="Sans hypothèse de loi normale. Complète le Sharpe, ne le remplace pas.">
        <MetricTable
          rows={[ROW.worstMonth, ROW.worstQuarter, ROW.expectedShortfall95, ROW.expectedShortfall99, ROW.downsideDeviation, ROW.skewness, ROW.excessKurtosis]}
          strategies={available}
          browne={browne}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          La volatilité mesure l’amplitude générale des variations. Les indicateurs de baisse étudient plus
          spécifiquement les pertes et les épisodes extrêmes.
        </p>
      </Section>

      <Section id="couts" title="Rotation et rééquilibrages" subtitle="Le coût de gestion fait partie intégrante du résultat.">
        <CostSection strategies={available} gross={grossById} />
      </Section>

      <Section id="allocation" title="Allocation actuelle" subtitle="Poids réellement détenus à la date d’analyse. L’allocation cible n’est pas une instruction de transaction.">
        <AllocationSection strategies={available} />
      </Section>

      <Section id="lecture" title="Lecture pédagogique">
        <PedagogySection strategies={strategies} filter={filter} />
      </Section>
    </div>
  );
}

/** Sections de navigation interne (scrollspy) de l'onglet. */
export const VS_BROWNE_SECTIONS = [
  { id: "synthese", label: "Synthèse" },
  { id: "performance", label: "Performance" },
  { id: "indicateurs", label: "Indicateurs" },
  { id: "drawdowns", label: "Drawdowns" },
  { id: "glissante", label: "Glissante" },
  { id: "risque-baisse", label: "Risque de baisse" },
  { id: "couts", label: "Coûts" },
  { id: "allocation", label: "Allocation" },
  { id: "lecture", label: "Lecture" },
];

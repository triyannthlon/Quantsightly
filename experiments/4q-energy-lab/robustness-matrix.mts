// ─────────────────────────────────────────────────────────────────────────────
// EXPORT BATCH — matrice de robustesse du Laboratoire Énergie (LECTURE SEULE).
//
// Compare `4q-standard-v2` vs `4q-standard-v2 + energy-trend-v1` sur EXACTEMENT les
// mêmes dates (fenêtre strictement commune), pour :
//   pays × stratégie(dynamic|binary) × période(commun|20a|10a|5a) × mode(nominal|réel).
//
// N'exploite QUE `computeEnergyLabComparison(country, strategy, version, windowYears)` +
// les helpers d'AFFICHAGE déjà utilisés par l'UI (`lab-window-metrics`, `lab-crises`) pour
// re-dériver les métriques du socle sur la fenêtre commune. NE MODIFIE : aucune formule,
// aucun poids, aucune règle d'activation, aucun financement, aucune fixture, aucun golden,
// aucun flag, aucune interface, aucune base. N'écrit QUE dans experiments/4q-energy-lab/output/.
//
//   pnpm exec tsx experiments/4q-energy-lab/robustness-matrix.mts
//   (essai rapide : LAB_SUBSET="US,JP" pnpm exec tsx experiments/4q-energy-lab/robustness-matrix.mts)
// ─────────────────────────────────────────────────────────────────────────────
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(HERE, "output");
mkdirSync(OUT, { recursive: true });

const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env
  .split(/\r?\n/)
  .find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length)
  .trim()
  .replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const wm: any = await imp("src/lib/coredata/four-quadrants/energy-trend-v1/lab-window-metrics.ts");
const labc: any = await imp("src/lib/coredata/four-quadrants/energy-trend-v1/lab-crises.ts");
const repo: any = await imp("src/lib/coredata/model-comparison/historical-stress/repository.ts");

// ─── Paramètres de l'étude ────────────────────────────────────────────────────
const STRATEGIES = ["dynamic", "binary"] as const;
type Strat = (typeof STRATEGIES)[number];
const PERIODS = [
  { key: "common", years: null as number | null },
  { key: "20y", years: 20 },
  { key: "10y", years: 10 },
  { key: "5y", years: 5 },
] as const;
const MODES = ["nominal", "real"] as const;
type Mode = (typeof MODES)[number];
const COST_BPS = [10, 25, 50] as const;
// Seuil de fiabilité statistique d'une fenêtre (mois). En-dessous : conservé mais marqué
// `statisticallyInsufficient` et EXCLU des agrégats de robustesse (cas Danemark).
const MIN_RELIABLE_MONTHS = 60;

const SUBSET = process.env.LAB_SUBSET
  ? new Set(process.env.LAB_SUBSET.split(",").map((s) => s.trim().toUpperCase()))
  : null;

// ─── Utilitaires ──────────────────────────────────────────────────────────────
const mk = (d: string) => d.slice(0, 7);
const monthIdx = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
const monthsBetween = (a: string, b: string) => monthIdx(b) - monthIdx(a) + 1;
const maxMonth = (a: string, b: string) => (a >= b ? a : b);
const minMonth = (a: string, b: string) => (a <= b ? a : b);
const r6 = (x: number | null): number | null => (x === null ? null : Math.round(x * 1e6) / 1e6);
const calmar = (ann: number | null, mdd: number | null): number | null =>
  ann === null || mdd === null || mdd >= 0 ? null : ann / Math.abs(mdd);

const warnings: string[] = [];
const warn = (m: string) => {
  if (!warnings.includes(m)) warnings.push(m);
};

/** Échec EXPLICIT (contrôle d'intégrité §5). */
function fail(msg: string): never {
  console.error(`\n❌ CONTRÔLE ÉCHOUÉ : ${msg}`);
  process.exit(1);
}
function assertFinite(label: string, v: number | null) {
  if (v !== null && !Number.isFinite(v))
    fail(`métrique non finie (NaN/Infinity) : ${label} = ${v}`);
}

// ─── Statistiques de signal (sur la frise filtrée à la fenêtre) ───────────────
function signalStats(history: any[], start: string, end: string) {
  const h = history.filter((x) => {
    const m = mk(x.date);
    return m >= start && m <= end;
  });
  const total = h.length;
  const active = h.filter((x) => x.state === "active").length;
  const unavailable = h.filter((x) => x.state === "unavailable").length;
  const runs: number[] = [];
  let cur = 0;
  let prev = "";
  let lastActivation: string | null = null;
  let lastDeactivation: string | null = null;
  for (const x of h) {
    if (x.state === "active") {
      if (prev !== "active") {
        lastActivation = x.date;
        cur = 0;
      }
      cur++;
    } else if (prev === "active") {
      runs.push(cur);
      lastDeactivation = x.date;
    }
    prev = x.state;
  }
  if (prev === "active") runs.push(cur);
  const sorted = [...runs].sort((a, b) => a - b);
  const mean = runs.length ? runs.reduce((s, v) => s + v, 0) / runs.length : 0;
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : 0;
  return {
    total,
    active,
    unavailable,
    activationRate: total ? active / total : 0,
    phases: runs.length,
    meanRun: mean,
    medianRun: median,
    maxRun: runs.length ? Math.max(...runs) : 0,
    lastActivation,
    lastDeactivation,
    availability: total ? (total - unavailable) / total : 0,
  };
}

// ─── Métriques d'une cellule (socle & Énergie sur la MÊME fenêtre) ────────────
const METRIC_KEYS = [
  "annualized",
  "volatility",
  "sharpe",
  "calmar",
  "maxDrawdown",
  "currentDrawdown",
  "maxUnderwaterMonths",
  "bestYear",
  "worstYear",
] as const;
type MetricKey = (typeof METRIC_KEYS)[number];

function cellMetrics(cmp: any, mode: Mode) {
  const std = cmp.standard.backtest;
  const en = cmp.energy.backtest;
  const stdSeries = mode === "real" ? std.series.real : std.series.nominal;
  const enSeries = mode === "real" ? en.series.real : en.series.nominal;
  // Contrôle §5 : mode réel demandé sans série réelle disponible.
  if (!stdSeries || !enSeries || stdSeries.length < 2 || enSeries.length < 2) {
    fail(`série ${mode} indisponible pour ${cmp.countryCode}:${cmp.strategy}`);
  }
  const aStart = maxMonth(mk(stdSeries[0].date), mk(enSeries[0].date));
  const aEnd = minMonth(
    mk(stdSeries[stdSeries.length - 1].date),
    mk(enSeries[enSeries.length - 1].date),
  );
  const enMetrics = mode === "real" ? en.metrics.real : en.metrics.nominal;
  const riskFree = wm.riskFreeFromMetrics(enMetrics);
  const sm = wm.windowMetrics(stdSeries, aStart, aEnd, riskFree);
  const em = wm.windowMetrics(enSeries, aStart, aEnd, riskFree);
  // Contrôle §5 : dates socle/variante identiques dans une cellule comparative.
  if (sm.months !== em.months) {
    fail(
      `fenêtres socle/Énergie différentes ${cmp.countryCode}:${cmp.strategy}:${mode} (${sm.months} vs ${em.months})`,
    );
  }
  const months = em.months;
  const val = (m: any, k: MetricKey): number | null => {
    if (k === "calmar") return calmar(m.annualized, m.maxDrawdown);
    return m[k] ?? null;
  };
  const std_v: Record<string, number | null> = {};
  const en_v: Record<string, number | null> = {};
  const delta_v: Record<string, number | null> = {};
  for (const k of METRIC_KEYS) {
    const s = val(sm, k);
    const e = val(em, k);
    assertFinite(`${cmp.countryCode}:${cmp.strategy}:${mode}:${k}:std`, s);
    assertFinite(`${cmp.countryCode}:${cmp.strategy}:${mode}:${k}:energy`, e);
    std_v[k] = s;
    en_v[k] = e;
    delta_v[k] = s !== null && e !== null ? e - s : null;
  }
  // Contrôle §5 : une durée ne dépasse pas la fenêtre commune.
  for (const m of [sm, em]) {
    if (m.maxUnderwaterMonths !== null && m.maxUnderwaterMonths > months) {
      fail(
        `durée sous l'eau > fenêtre ${cmp.countryCode}:${cmp.strategy}:${mode} (${m.maxUnderwaterMonths}/${months})`,
      );
    }
  }
  return { start: aStart, end: aEnd, months, std: std_v, energy: en_v, delta: delta_v };
}

// ─── Collecte ─────────────────────────────────────────────────────────────────
const allCountries: Array<{ iso: string; nameFr: string }> = await svc.listQuadrantCountries();
const countries = allCountries
  .filter((c) => !SUBSET || SUBSET.has(c.iso))
  .sort((a, b) => a.iso.localeCompare(b.iso));
const crisesRegistry = await repo.listHistoricalCrises();

interface MetricRow {
  countryCode: string;
  country: string;
  strategy: Strat;
  mode: Mode;
  period: string;
  status: "ok" | "insufficient_history";
  statisticallyInsufficient: boolean;
  start: string | null;
  end: string | null;
  months: number | null;
  metrics: Record<string, { std: number | null; energy: number | null; delta: number | null }>;
  netDeltaAnnualized: Record<string, number | null>; // par hypothèse de coûts (bps)
}
interface SignalRow {
  countryCode: string;
  country: string;
  strategy: Strat;
  period: string;
  status: "ok" | "insufficient_history";
  statisticallyInsufficient: boolean;
  start: string | null;
  end: string | null;
  months: number | null;
  turnoverStd: number | null;
  turnoverEnergy: number | null;
  turnoverDelta: number | null;
  turnover12mStd: number | null;
  turnover12mEnergy: number | null;
  contributionEnergyNominal: number | null;
  activeMonths: number | null;
  activationRate: number | null;
  phases: number | null;
  meanRunMonths: number | null;
  medianRunMonths: number | null;
  maxRunMonths: number | null;
  lastActivation: string | null;
  lastDeactivation: string | null;
  signalAvailability: number | null;
}
interface CrisisRow {
  countryCode: string;
  country: string;
  strategy: Strat;
  mode: Mode;
  period: string;
  crisisId: string;
  crisisName: string;
  crisisStart: string;
  crisisEnd: string;
  durationMonths: number;
  perfStd: number | null;
  perfEnergy: number | null;
  perfDelta: number | null;
  maxddStd: number | null;
  maxddEnergy: number | null;
  maxddDelta: number | null;
}

const metricRows: MetricRow[] = [];
const signalRows: SignalRow[] = [];
const crisisRows: CrisisRow[] = [];

// Coût annualisé (%) du SUPPLÉMENT de rotation : turnover unidirectionnel × 2 (aller-retour)
// × bps/10000 × 100. Δnet = Δperf − 2·Δturnover·bps/10000·100.
const netDelta = (
  deltaAnn: number | null,
  deltaTurnover: number | null,
  bps: number,
): number | null =>
  deltaAnn === null || deltaTurnover === null
    ? null
    : deltaAnn - 2 * deltaTurnover * (bps / 10000) * 100;

let cmpCalls = 0;
for (const c of countries) {
  for (const strat of STRATEGIES) {
    const commonCmp = await svc.computeEnergyLabComparison(c.iso, strat, undefined, null);
    cmpCalls++;
    if (!commonCmp) {
      warn(
        `${c.iso}:${strat} — aucune comparaison labo exploitable (toutes périodes marquées insufficient).`,
      );
      for (const p of PERIODS) {
        for (const mode of MODES) metricRows.push(insufficientMetric(c, strat, mode, p.key));
        signalRows.push(insufficientSignal(c, strat, p.key));
      }
      continue;
    }
    // Fenêtre commune de référence (mode nominal) → nb de mois → périodes réalisables.
    const commonMonths = monthsBetween(
      mk(commonCmp.energy.backtest.start),
      mk(commonCmp.energy.backtest.end),
    );

    for (const p of PERIODS) {
      const feasible = p.years === null || commonMonths >= p.years * 12;
      if (!feasible) {
        for (const mode of MODES)
          metricRows.push(insufficientMetric(c, strat, mode, p.key, commonMonths, commonCmp));
        signalRows.push(insufficientSignal(c, strat, p.key, commonMonths, commonCmp));
        continue;
      }
      const cmp =
        p.years === null
          ? commonCmp
          : await svc.computeEnergyLabComparison(c.iso, strat, undefined, p.years);
      if (p.years !== null) cmpCalls++;
      if (!cmp) fail(`combinaison attendue absente sans statut : ${c.iso}:${strat}:${p.key}`);

      // — métriques par mode
      let winStart = "";
      let winEnd = "";
      let winMonths = 0;
      let deltaTurnover: number | null = null;
      for (const mode of MODES) {
        const cm = cellMetrics(cmp, mode);
        winStart = winStart || cm.start;
        winEnd = winEnd || cm.end;
        winMonths = winMonths || cm.months;
        const statInsuff = cm.months < MIN_RELIABLE_MONTHS;
        if (statInsuff)
          warn(
            `${c.iso}:${strat}:${p.key} — fenêtre ${cm.months} mois < ${MIN_RELIABLE_MONTHS} : exclu des agrégats.`,
          );
        const metrics: MetricRow["metrics"] = {};
        for (const k of METRIC_KEYS)
          metrics[k] = { std: r6(cm.std[k]), energy: r6(cm.energy[k]), delta: r6(cm.delta[k]) };
        // Δturnover (indépendant du mode) — calculé une fois sur la fenêtre nominale.
        if (deltaTurnover === null) {
          const tStd = wm.windowTurnoverAnnualized(
            cmp.standard.backtest.turnover.monthly,
            cm.start,
            cm.end,
          );
          const tEn = wm.windowTurnoverAnnualized(
            cmp.energy.backtest.turnover.monthly,
            cm.start,
            cm.end,
          );
          deltaTurnover = tStd !== null && tEn !== null ? tEn - tStd : null;
        }
        const net: Record<string, number | null> = {};
        for (const bps of COST_BPS)
          net[String(bps)] = r6(netDelta(cm.delta.annualized, deltaTurnover, bps));
        metricRows.push({
          countryCode: c.iso,
          country: c.nameFr,
          strategy: strat,
          mode,
          period: p.key,
          status: "ok",
          statisticallyInsufficient: statInsuff,
          start: cm.start,
          end: cm.end,
          months: cm.months,
          metrics,
          netDeltaAnnualized: net,
        });

        // — crises (par mode) : uniquement les crises ENTIÈREMENT couvertes (closed, non provisoires)
        const results = labc.buildEnergyLabCrises(cmp, mode, crisesRegistry);
        if (results) {
          for (const r of results) {
            if (r.provisional) continue; // exclut ongoing / bornes provisoires
            if (r.durationMonths > cm.months)
              fail(`crise ${r.crisis.id} > fenêtre ${c.iso}:${strat}:${p.key}:${mode}`);
            const byId = new Map(r.strategies.map((s: any) => [s.strategyId, s]));
            const s = byId.get(labc.LAB_CRISIS_SLOTS.standard) as any;
            const e = byId.get(labc.LAB_CRISIS_SLOTS.energy) as any;
            if (!s || !e || !s.available || !e.available) continue;
            crisisRows.push({
              countryCode: c.iso,
              country: c.nameFr,
              strategy: strat,
              mode,
              period: p.key,
              crisisId: r.crisis.id,
              crisisName: r.crisis.name,
              crisisStart: mk(r.effectiveStartDate),
              crisisEnd: mk(r.effectiveEndDate),
              durationMonths: r.durationMonths,
              perfStd: r6(s.cumulativeReturn),
              perfEnergy: r6(e.cumulativeReturn),
              perfDelta: r6(
                s.cumulativeReturn !== null && e.cumulativeReturn !== null
                  ? e.cumulativeReturn - s.cumulativeReturn
                  : null,
              ),
              maxddStd: r6(s.maxDrawdown),
              maxddEnergy: r6(e.maxDrawdown),
              maxddDelta: r6(
                s.maxDrawdown !== null && e.maxDrawdown !== null
                  ? e.maxDrawdown - s.maxDrawdown
                  : null,
              ),
            });
          }
        }
      }

      // — signal & rotation (une ligne par pays×stratégie×période, fenêtre nominale)
      const tStd = wm.windowTurnoverAnnualized(
        cmp.standard.backtest.turnover.monthly,
        winStart,
        winEnd,
      );
      const tEn = wm.windowTurnoverAnnualized(
        cmp.energy.backtest.turnover.monthly,
        winStart,
        winEnd,
      );
      const t12Std = wm.windowTurnoverTrailing12(cmp.standard.backtest.turnover.monthly, winEnd);
      const t12En = wm.windowTurnoverTrailing12(cmp.energy.backtest.turnover.monthly, winEnd);
      const sig = signalStats(cmp.signal.history, winStart, winEnd);
      const statInsuff = winMonths < MIN_RELIABLE_MONTHS;
      signalRows.push({
        countryCode: c.iso,
        country: c.nameFr,
        strategy: strat,
        period: p.key,
        status: "ok",
        statisticallyInsufficient: statInsuff,
        start: winStart,
        end: winEnd,
        months: winMonths,
        turnoverStd: r6(tStd),
        turnoverEnergy: r6(tEn),
        turnoverDelta: r6(tStd !== null && tEn !== null ? tEn - tStd : null),
        turnover12mStd: r6(t12Std),
        turnover12mEnergy: r6(t12En),
        contributionEnergyNominal: r6(cmp.energy.backtest.contributions.energy),
        activeMonths: sig.active,
        activationRate: r6(sig.activationRate),
        phases: sig.phases,
        meanRunMonths: r6(sig.meanRun),
        medianRunMonths: r6(sig.medianRun),
        maxRunMonths: sig.maxRun,
        lastActivation: sig.lastActivation ? mk(sig.lastActivation) : null,
        lastDeactivation: sig.lastDeactivation ? mk(sig.lastDeactivation) : null,
        signalAvailability: r6(sig.availability),
      });
    }
  }
}

// Lignes « insufficient_history » (durée indisponible) — jamais de suppression silencieuse.
function insufficientMetric(
  c: { iso: string; nameFr: string },
  strat: Strat,
  mode: Mode,
  period: string,
  months?: number,
  commonCmp?: any,
): MetricRow {
  const metrics: MetricRow["metrics"] = {};
  for (const k of METRIC_KEYS) metrics[k] = { std: null, energy: null, delta: null };
  const net: Record<string, number | null> = {};
  for (const bps of COST_BPS) net[String(bps)] = null;
  return {
    countryCode: c.iso,
    country: c.nameFr,
    strategy: strat,
    mode,
    period,
    status: "insufficient_history",
    statisticallyInsufficient: true,
    start: commonCmp ? mk(commonCmp.energy.backtest.start) : null,
    end: commonCmp ? mk(commonCmp.energy.backtest.end) : null,
    months: months ?? null,
    metrics,
    netDeltaAnnualized: net,
  };
}
function insufficientSignal(
  c: { iso: string; nameFr: string },
  strat: Strat,
  period: string,
  months?: number,
  commonCmp?: any,
): SignalRow {
  return {
    countryCode: c.iso,
    country: c.nameFr,
    strategy: strat,
    period,
    status: "insufficient_history",
    statisticallyInsufficient: true,
    start: commonCmp ? mk(commonCmp.energy.backtest.start) : null,
    end: commonCmp ? mk(commonCmp.energy.backtest.end) : null,
    months: months ?? null,
    turnoverStd: null,
    turnoverEnergy: null,
    turnoverDelta: null,
    turnover12mStd: null,
    turnover12mEnergy: null,
    contributionEnergyNominal: null,
    activeMonths: null,
    activationRate: null,
    phases: null,
    meanRunMonths: null,
    medianRunMonths: null,
    maxRunMonths: null,
    lastActivation: null,
    lastDeactivation: null,
    signalAvailability: null,
  };
}

// ─── Synthèse (stratégie × période × mode), Danemark & fenêtres courtes exclus ─
const SUMMARY_DELTAS = ["annualized", "sharpe", "calmar", "maxDrawdown"] as const;
function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}
interface SummaryRow {
  strategy: Strat;
  period: string;
  mode: Mode;
  nOk: number;
  nInsufficient: number;
  nExcludedShort: number;
  dist: Record<
    string,
    {
      median: number | null;
      q1: number | null;
      q3: number | null;
      min: number | null;
      max: number | null;
    }
  >;
  shareAnnualizedPos: number | null;
  shareSharpePos: number | null;
  shareCalmarPos: number | null;
  shareMaxddImproved: number | null;
  shareSharpeAndMaxdd: number | null;
}
const summaryRows: SummaryRow[] = [];
for (const strat of STRATEGIES) {
  for (const p of PERIODS) {
    for (const mode of MODES) {
      const cells = metricRows.filter(
        (r) => r.strategy === strat && r.period === p.key && r.mode === mode,
      );
      const ok = cells.filter((r) => r.status === "ok" && !r.statisticallyInsufficient);
      const dist: SummaryRow["dist"] = {};
      for (const k of SUMMARY_DELTAS) {
        const vals = ok
          .map((r) => r.metrics[k].delta)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b);
        dist[k] = {
          median: r6(quantile(vals, 0.5)),
          q1: r6(quantile(vals, 0.25)),
          q3: r6(quantile(vals, 0.75)),
          min: vals.length ? r6(vals[0]) : null,
          max: vals.length ? r6(vals[vals.length - 1]) : null,
        };
      }
      const n = ok.length;
      const share = (pred: (r: MetricRow) => boolean) =>
        n ? r6(ok.filter(pred).length / n) : null;
      summaryRows.push({
        strategy: strat,
        period: p.key,
        mode,
        nOk: n,
        nInsufficient: cells.filter((r) => r.status === "insufficient_history").length,
        nExcludedShort: cells.filter((r) => r.status === "ok" && r.statisticallyInsufficient)
          .length,
        dist,
        shareAnnualizedPos: share((r) => (r.metrics.annualized.delta ?? -1) > 0),
        shareSharpePos: share((r) => (r.metrics.sharpe.delta ?? -1) > 0),
        shareCalmarPos: share((r) => (r.metrics.calmar.delta ?? -1) > 0),
        shareMaxddImproved: share((r) => (r.metrics.maxDrawdown.delta ?? -1) > 0),
        shareSharpeAndMaxdd: share(
          (r) => (r.metrics.sharpe.delta ?? -1) > 0 && (r.metrics.maxDrawdown.delta ?? -1) > 0,
        ),
      });
    }
  }
}

// ─── Écriture CSV ─────────────────────────────────────────────────────────────
const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (headers: string[], rows: unknown[][]) =>
  [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n";

// metrics.csv
const metricHeaders = [
  "country_code",
  "country",
  "strategy",
  "mode",
  "period",
  "status",
  "statistically_insufficient",
  "start",
  "end",
  "months",
  ...METRIC_KEYS.flatMap((k) => [`${k}_std`, `${k}_energy`, `${k}_delta`]),
  ...COST_BPS.map((b) => `delta_annualized_net_${b}bps`),
];
const metricCsvRows = metricRows.map((r) => [
  r.countryCode,
  r.country,
  r.strategy,
  r.mode,
  r.period,
  r.status,
  r.statisticallyInsufficient,
  r.start,
  r.end,
  r.months,
  ...METRIC_KEYS.flatMap((k) => [r.metrics[k].std, r.metrics[k].energy, r.metrics[k].delta]),
  ...COST_BPS.map((b) => r.netDeltaAnnualized[String(b)]),
]);
writeFileSync(path.join(OUT, "metrics.csv"), toCsv(metricHeaders, metricCsvRows));

// signal-and-turnover.csv
const signalHeaders = [
  "country_code",
  "country",
  "strategy",
  "period",
  "status",
  "statistically_insufficient",
  "start",
  "end",
  "months",
  "turnover_annualized_std",
  "turnover_annualized_energy",
  "turnover_annualized_delta",
  "turnover_12m_std",
  "turnover_12m_energy",
  "contribution_energy_nominal_pts",
  "active_months",
  "activation_rate",
  "active_phases",
  "mean_run_months",
  "median_run_months",
  "max_run_months",
  "last_activation",
  "last_deactivation",
  "signal_availability",
];
const signalCsvRows = signalRows.map((r) => [
  r.countryCode,
  r.country,
  r.strategy,
  r.period,
  r.status,
  r.statisticallyInsufficient,
  r.start,
  r.end,
  r.months,
  r.turnoverStd,
  r.turnoverEnergy,
  r.turnoverDelta,
  r.turnover12mStd,
  r.turnover12mEnergy,
  r.contributionEnergyNominal,
  r.activeMonths,
  r.activationRate,
  r.phases,
  r.meanRunMonths,
  r.medianRunMonths,
  r.maxRunMonths,
  r.lastActivation,
  r.lastDeactivation,
  r.signalAvailability,
]);
writeFileSync(path.join(OUT, "signal-and-turnover.csv"), toCsv(signalHeaders, signalCsvRows));

// crises.csv (tri déterministe)
crisisRows.sort(
  (a, b) =>
    a.countryCode.localeCompare(b.countryCode) ||
    a.strategy.localeCompare(b.strategy) ||
    a.period.localeCompare(b.period) ||
    a.mode.localeCompare(b.mode) ||
    a.crisisId.localeCompare(b.crisisId),
);
const crisisHeaders = [
  "country_code",
  "country",
  "strategy",
  "mode",
  "period",
  "crisis_id",
  "crisis_name",
  "crisis_start",
  "crisis_end",
  "duration_months",
  "perf_std",
  "perf_energy",
  "perf_delta",
  "maxdd_std",
  "maxdd_energy",
  "maxdd_delta",
];
const crisisCsvRows = crisisRows.map((r) => [
  r.countryCode,
  r.country,
  r.strategy,
  r.mode,
  r.period,
  r.crisisId,
  r.crisisName,
  r.crisisStart,
  r.crisisEnd,
  r.durationMonths,
  r.perfStd,
  r.perfEnergy,
  r.perfDelta,
  r.maxddStd,
  r.maxddEnergy,
  r.maxddDelta,
]);
writeFileSync(path.join(OUT, "crises.csv"), toCsv(crisisHeaders, crisisCsvRows));

// summary.csv
const summaryHeaders = [
  "strategy",
  "period",
  "mode",
  "n_ok",
  "n_insufficient",
  "n_excluded_short",
  ...SUMMARY_DELTAS.flatMap((k) => [`${k}_median`, `${k}_q1`, `${k}_q3`, `${k}_min`, `${k}_max`]),
  "share_annualized_pos",
  "share_sharpe_pos",
  "share_calmar_pos",
  "share_maxdd_improved",
  "share_sharpe_and_maxdd",
];
const summaryCsvRows = summaryRows.map((r) => [
  r.strategy,
  r.period,
  r.mode,
  r.nOk,
  r.nInsufficient,
  r.nExcludedShort,
  ...SUMMARY_DELTAS.flatMap((k) => [
    r.dist[k].median,
    r.dist[k].q1,
    r.dist[k].q3,
    r.dist[k].min,
    r.dist[k].max,
  ]),
  r.shareAnnualizedPos,
  r.shareSharpePos,
  r.shareCalmarPos,
  r.shareMaxddImproved,
  r.shareSharpeAndMaxdd,
]);
writeFileSync(path.join(OUT, "summary.csv"), toCsv(summaryHeaders, summaryCsvRows));

// robustness-data.json
writeFileSync(
  path.join(OUT, "robustness-data.json"),
  JSON.stringify(
    {
      metrics: metricRows,
      signalAndTurnover: signalRows,
      crises: crisisRows,
      summary: summaryRows,
    },
    null,
    2,
  ) + "\n",
);

// ─── Contrôles de complétude §5 ───────────────────────────────────────────────
const okMetricCells = metricRows.filter((r) => r.status === "ok").length;
const okSignalCells = signalRows.filter((r) => r.status === "ok").length;
const totalMetricExpected = countries.length * STRATEGIES.length * PERIODS.length * MODES.length;
const totalSignalExpected = countries.length * STRATEGIES.length * PERIODS.length;
if (metricRows.length !== totalMetricExpected)
  fail(
    `lignes metrics ${metricRows.length} ≠ attendu ${totalMetricExpected} (combinaison disparue)`,
  );
if (signalRows.length !== totalSignalExpected)
  fail(`lignes signal ${signalRows.length} ≠ attendu ${totalSignalExpected}`);
if (!SUBSET) {
  if (okMetricCells !== 308) fail(`cellules métriques OK = ${okMetricCells}, attendu 308`);
  if (okSignalCells !== 154) fail(`cellules signal OK = ${okSignalCells}, attendu 154`);
}

// ─── manifest.json ────────────────────────────────────────────────────────────
// `executedAtGitHash` = HEAD au moment de l'exécution (traçabilité brute). `sourceGitCommit`
// = commit dont le MODÈLE alimente cet instantané (par défaut HEAD ; forçable via LAB_SOURCE_COMMIT
// si l'export est régénéré après avoir committé l'outil, pour conserver la référence au modèle).
const executedAtGitHash = execSync("git rev-parse HEAD", { cwd: ROOT }).toString().trim();
const gitBranch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT }).toString().trim();
const sourceGitCommit = process.env.LAB_SOURCE_COMMIT?.trim() || executedAtGitHash;
writeFileSync(
  path.join(OUT, "manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceGitCommit,
      executedAtGitHash,
      gitBranch,
      standardModel: "4q-standard-v2",
      energyOverlay: "energy-trend-v1",
      modelVersionParam: "default (DEFAULT_MODEL_VERSION)",
      subset: SUBSET ? [...SUBSET] : null,
      countries: countries.map((c) => c.iso),
      strategies: STRATEGIES,
      periods: PERIODS.map((p) => p.key),
      modes: MODES,
      rotationConvention:
        "Rotation UNIDIRECTIONNELLE (½·Σ|Δw|), annualisée sur la fenêtre analysée (mois de départ = constitution, exclu). Un rééquilibrage = achat + vente ⇒ volume échangé = 2 × rotation.",
      costAssumptionsBps: COST_BPS,
      costConvention:
        "POST-TRAITEMENT uniquement (jamais injecté dans le backtest, résultats bruts inchangés). Coût annuel = 2 × rotation_unidirectionnelle × bps/10000 (aller-retour). Δnet = Δperf% − 2·Δturnover·(bps/10000)·100. NB : approximation annualisée ; l'audit produit en complément un net mensuel série par série.",
      statisticalExclusions: [
        `Fenêtre < ${MIN_RELIABLE_MONTHS} mois → marquée statistically_insufficient et EXCLUE des agrégats (summary).`,
        "Danemark (historique commun ~21 mois) : ligne « commun » conservée mais exclue des agrégats ; horizons 5/10/20 ans = insufficient_history (jamais générés).",
        "Horizon indisponible (historique commun < années × 12) → ligne insufficient_history, jamais supprimée.",
      ],
      minReliableMonths: MIN_RELIABLE_MONTHS,
      cmpCalls,
      rowCounts: {
        metrics: metricRows.length,
        metricsOk: okMetricCells,
        signalAndTurnover: signalRows.length,
        signalOk: okSignalCells,
        crises: crisisRows.length,
        summary: summaryRows.length,
      },
      checksumsExclude: ["manifest.json (contient generatedAt/horodatage, non reproductible)"],
      warnings,
      caveat:
        "Les pays et les horizons ne sont PAS statistiquement indépendants : marchés corrélés ; fenêtres emboîtées (5a ⊂ 10a ⊂ 20a ⊂ commun). Aucun score composite, aucune décision produit dans cet export.",
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `\n✅ Export terminé — ${countries.length} pays · ${cmpCalls} appels computeEnergyLabComparison`,
);
console.log(
  `  metrics: ${metricRows.length} (OK ${okMetricCells}) · signal: ${signalRows.length} (OK ${okSignalCells}) · crises: ${crisisRows.length} · summary: ${summaryRows.length}`,
);
console.log(`  avertissements: ${warnings.length}`);
console.log(`  → ${path.relative(ROOT, OUT)}/`);
process.exit(0);

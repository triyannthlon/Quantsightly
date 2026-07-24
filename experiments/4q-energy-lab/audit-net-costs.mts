// ─────────────────────────────────────────────────────────────────────────────
// AUDIT B — métriques RÉELLEMENT nettes de coûts (LECTURE SEULE).
//
// En POST-TRAITEMENT (jamais dans le backtest), on applique les coûts MENSUELLEMENT à chaque
// stratégie séparément, puis on RECALCULE toutes les métriques à partir des séries nettes
// (surtout PAS en soustrayant un coût annualisé à la perf brute).
//
// Convention : la rotation `turnover` est UNIDIRECTIONNELLE (½·Σ|Δw|). Un rééquilibrage = achat +
// vente ⇒ volume échangé = 2 × turnover (aller-retour). Coût du mois t = 2 × turnover_t × bps/10000,
// imputé au mois où la rotation est enregistrée : rendement_net_t = rendement_brut_t − coût_t.
// Le cash sert de taux sans risque du Sharpe (fenêtre analysée) ; sa rotation étant ~0 (poche de
// financement résiduelle), on réutilise le cash de la fenêtre (coût de transaction du cash négligé).
//
// Sortie : experiments/4q-energy-lab/output-audit/{net-metrics.csv, net-summary.csv} (NON committé).
//   pnpm exec tsx experiments/4q-energy-lab/audit-net-costs.mts
// ─────────────────────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(HERE, "output-audit");
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

const STRATS = ["dynamic", "binary"] as const;
const PERIODS = [
  { key: "common", years: null as number | null },
  { key: "20y", years: 20 },
  { key: "10y", years: 10 },
  { key: "5y", years: 5 },
];
const MODES = ["nominal", "real"] as const;
const BPS = [10, 25, 50] as const;
const MIN_RELIABLE_MONTHS = 60;

type Pt = { date: string; value: number };
const mk = (d: string) => d.slice(0, 7);
const maxMonth = (a: string, b: string) => (a >= b ? a : b);
const minMonth = (a: string, b: string) => (a <= b ? a : b);
const monthsBetween = (a: string, b: string) =>
  Number(b.slice(0, 4)) * 12 +
  Number(b.slice(5, 7)) -
  (Number(a.slice(0, 4)) * 12 + Number(a.slice(5, 7))) +
  1;
const clip = (s: Pt[], a: string, b: string) => s.filter((p) => mk(p.date) >= a && mk(p.date) <= b);
const r6 = (x: number | null) =>
  x === null || !Number.isFinite(x) ? null : Math.round(x * 1e6) / 1e6;

// ── Série NETTE mensuelle : net_t = net_{t-1}·(1 + brut_t − 2·turnover_t·bps/10000) ─────────────
function netSeries(seriesClipped: Pt[], monthly: any[], bps: number): Pt[] {
  const turnBy = new Map<string, number>();
  for (const t of monthly) if (t.turnover !== null) turnBy.set(mk(t.date), t.turnover);
  const out: Pt[] = [{ date: seriesClipped[0].date, value: 100 }];
  let v = 100;
  for (let i = 1; i < seriesClipped.length; i++) {
    const gross = seriesClipped[i].value / seriesClipped[i - 1].value - 1;
    const turn = turnBy.get(mk(seriesClipped[i].date)) ?? 0;
    const cost = 2 * turn * (bps / 10000);
    v *= 1 + gross - cost;
    out.push({ date: seriesClipped[i].date, value: v });
  }
  return out;
}

// ── Métriques inline (mêmes formules que le moteur) ─────────────────────────────
function annualized(s: Pt[]): number | null {
  if (s.length < 2) return null;
  return (Math.pow(s[s.length - 1].value / s[0].value, 12 / (s.length - 1)) - 1) * 100;
}
function volatility(s: Pt[]): number | null {
  if (s.length < 3) return null;
  const r = s.slice(1).map((p, i) => p.value / s[i].value - 1);
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(12) * 100;
}
function maxDrawdown(s: Pt[]): number | null {
  if (s.length < 2) return null;
  let peak = -Infinity;
  let mdd = 0;
  for (const p of s) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) mdd = Math.min(mdd, (p.value / peak - 1) * 100);
  }
  return mdd;
}
function underwater(s: Pt[]): number | null {
  if (s.length < 2) return null;
  let peak = -Infinity;
  let run = 0;
  let mx = 0;
  for (const p of s) {
    if (p.value >= peak) {
      peak = p.value;
      run = 0;
    } else {
      run++;
      mx = Math.max(mx, run);
    }
  }
  return mx;
}
function calendarYears(s: Pt[]): number[] {
  const byY = new Map<string, number>();
  for (const p of s) byY.set(p.date.slice(0, 4), p.value);
  const ys = [...byY.keys()].sort();
  const out: number[] = [];
  for (let i = 1; i < ys.length; i++) {
    const a = byY.get(ys[i - 1])!;
    const b = byY.get(ys[i])!;
    if (a > 0) out.push((b / a - 1) * 100);
  }
  return out;
}
function netMetrics(s: Pt[], riskFree: number | null) {
  const ann = annualized(s);
  const vol = volatility(s);
  const mdd = maxDrawdown(s);
  const ys = calendarYears(s);
  const sharpe =
    ann !== null && vol !== null && vol > 0 && riskFree !== null ? (ann - riskFree) / vol : null;
  const calmar = ann !== null && mdd !== null && mdd < 0 ? ann / Math.abs(mdd) : null;
  return {
    annualized: ann,
    volatility: vol,
    sharpe,
    calmar,
    maxDrawdown: mdd,
    maxUnderwaterMonths: underwater(s),
    bestYear: ys.length ? Math.max(...ys) : null,
    worstYear: ys.length ? Math.min(...ys) : null,
  };
}

// ── Collecte plein-matrice ──────────────────────────────────────────────────────
const countries: Array<{ iso: string; nameFr: string }> = (await svc.listQuadrantCountries()).sort(
  (a: any, b: any) => a.iso.localeCompare(b.iso),
);
const NET_KEYS = [
  "annualized",
  "volatility",
  "sharpe",
  "calmar",
  "maxDrawdown",
  "maxUnderwaterMonths",
  "bestYear",
  "worstYear",
] as const;
interface Row {
  iso: string;
  country: string;
  strategy: string;
  period: string;
  mode: string;
  bps: number;
  status: string;
  statInsuff: boolean;
  months: number | null;
  std: Record<string, number | null>;
  energy: Record<string, number | null>;
  delta: Record<string, number | null>;
}
const rows: Row[] = [];

for (const c of countries) {
  for (const strat of STRATS) {
    const commonCmp = await svc.computeEnergyLabComparison(c.iso, strat, undefined, null);
    if (!commonCmp) continue;
    const commonMonths = monthsBetween(
      mk(commonCmp.energy.backtest.start),
      mk(commonCmp.energy.backtest.end),
    );
    for (const p of PERIODS) {
      const feasible = p.years === null || commonMonths >= p.years * 12;
      if (!feasible) {
        for (const mode of MODES)
          for (const bps of BPS) rows.push(insufficient(c, strat, p.key, mode, bps));
        continue;
      }
      const cmp =
        p.years === null
          ? commonCmp
          : await svc.computeEnergyLabComparison(c.iso, strat, undefined, p.years);
      if (!cmp) continue;
      for (const mode of MODES) {
        const stdS: Pt[] =
          mode === "real"
            ? cmp.standard.backtest.series.real
            : cmp.standard.backtest.series.nominal;
        const enS: Pt[] =
          mode === "real" ? cmp.energy.backtest.series.real : cmp.energy.backtest.series.nominal;
        if (!stdS || !enS) continue;
        const aStart = maxMonth(mk(stdS[0].date), mk(enS[0].date));
        const aEnd = minMonth(mk(stdS[stdS.length - 1].date), mk(enS[enS.length - 1].date));
        const months = monthsBetween(aStart, aEnd);
        const statInsuff = months < MIN_RELIABLE_MONTHS;
        const rf = wm.riskFreeFromMetrics(
          mode === "real" ? cmp.energy.backtest.metrics.real : cmp.energy.backtest.metrics.nominal,
        );
        const stdC = clip(stdS, aStart, aEnd);
        const enC = clip(enS, aStart, aEnd);
        for (const bps of BPS) {
          const sm = netMetrics(netSeries(stdC, cmp.standard.backtest.turnover.monthly, bps), rf);
          const em = netMetrics(netSeries(enC, cmp.energy.backtest.turnover.monthly, bps), rf);
          const std: Record<string, number | null> = {};
          const energy: Record<string, number | null> = {};
          const delta: Record<string, number | null> = {};
          for (const k of NET_KEYS) {
            std[k] = r6(sm[k]);
            energy[k] = r6(em[k]);
            delta[k] =
              sm[k] !== null && em[k] !== null ? r6((em[k] as number) - (sm[k] as number)) : null;
          }
          rows.push({
            iso: c.iso,
            country: c.nameFr,
            strategy: strat,
            period: p.key,
            mode,
            bps,
            status: "ok",
            statInsuff,
            months,
            std,
            energy,
            delta,
          });
        }
      }
    }
  }
}
function insufficient(
  c: { iso: string; nameFr: string },
  strat: string,
  period: string,
  mode: string,
  bps: number,
): Row {
  const empty: Record<string, number | null> = {};
  for (const k of NET_KEYS) empty[k] = null;
  return {
    iso: c.iso,
    country: c.nameFr,
    strategy: strat,
    period,
    mode,
    bps,
    status: "insufficient_history",
    statInsuff: true,
    months: null,
    std: { ...empty },
    energy: { ...empty },
    delta: { ...empty },
  };
}

// ── net-metrics.csv (long) ──────────────────────────────────────────────────────
const csv = (h: string[], rr: unknown[][]) =>
  [
    h.join(","),
    ...rr.map((r) =>
      r
        .map((v) =>
          v === null || v === undefined
            ? ""
            : /[",\n]/.test(String(v))
              ? `"${String(v).replace(/"/g, '""')}"`
              : String(v),
        )
        .join(","),
    ),
  ].join("\n") + "\n";
const headers = [
  "country_code",
  "country",
  "strategy",
  "period",
  "mode",
  "bps",
  "status",
  "statistically_insufficient",
  "months",
  ...NET_KEYS.flatMap((k) => [`${k}_std`, `${k}_energy`, `${k}_delta`]),
];
writeFileSync(
  path.join(OUT, "net-metrics.csv"),
  csv(
    headers,
    rows.map((r) => [
      r.iso,
      r.country,
      r.strategy,
      r.period,
      r.mode,
      r.bps,
      r.status,
      r.statInsuff,
      r.months,
      ...NET_KEYS.flatMap((k) => [r.std[k], r.energy[k], r.delta[k]]),
    ]),
  ),
);

// ── net-summary.csv : distribution du Δ (par stratégie × période × mode × bps) ──
// Bandes DECISION-CRITERIA : ΔSharpe net favorable ≥ +0,05 ; Δrendement net favorable ≥ +0,25.
function quantile(a: number[], q: number): number | null {
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const b = Math.floor(pos);
  return a[b + 1] !== undefined ? a[b] + (pos - b) * (a[b + 1] - a[b]) : a[b];
}
const sumHeaders = [
  "strategy",
  "period",
  "mode",
  "bps",
  "n_ok",
  "sharpe_delta_median",
  "sharpe_delta_q1",
  "sharpe_delta_q3",
  "sharpe_delta_min",
  "sharpe_delta_max",
  "annualized_delta_median",
  "annualized_delta_min",
  "annualized_delta_max",
  "maxdd_delta_median",
  "maxdd_delta_min",
  "share_sharpe_fav_0p05",
  "share_annualized_fav_0p25",
  "share_sharpe_and_maxdd_pos",
];
const sumRows: unknown[][] = [];
for (const strat of STRATS)
  for (const p of PERIODS)
    for (const mode of MODES)
      for (const bps of BPS) {
        const cells = rows.filter(
          (r) =>
            r.strategy === strat &&
            r.period === p.key &&
            r.mode === mode &&
            r.bps === bps &&
            r.status === "ok" &&
            !r.statInsuff,
        );
        const ds = cells
          .map((r) => r.delta.sharpe)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b);
        const da = cells
          .map((r) => r.delta.annualized)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b);
        const dd = cells
          .map((r) => r.delta.maxDrawdown)
          .filter((v): v is number => v !== null)
          .sort((a, b) => a - b);
        const n = cells.length;
        const share = (pred: (r: Row) => boolean) => (n ? r6(cells.filter(pred).length / n) : null);
        sumRows.push([
          strat,
          p.key,
          mode,
          bps,
          n,
          r6(quantile(ds, 0.5)),
          r6(quantile(ds, 0.25)),
          r6(quantile(ds, 0.75)),
          ds.length ? r6(ds[0]) : null,
          ds.length ? r6(ds[ds.length - 1]) : null,
          r6(quantile(da, 0.5)),
          da.length ? r6(da[0]) : null,
          da.length ? r6(da[da.length - 1]) : null,
          r6(quantile(dd, 0.5)),
          dd.length ? r6(dd[0]) : null,
          share((r) => (r.delta.sharpe ?? -1) >= 0.05),
          share((r) => (r.delta.annualized ?? -1) >= 0.25),
          share((r) => (r.delta.sharpe ?? -1) > 0 && (r.delta.maxDrawdown ?? -1) > 0),
        ]);
      }
writeFileSync(path.join(OUT, "net-summary.csv"), csv(sumHeaders, sumRows));

console.log(
  `\n✅ AUDIT B (net de coûts) — ${rows.length} lignes net-metrics · ${sumRows.length} lignes net-summary`,
);
console.log(
  `  convention : coût_t = 2 × turnover_unidirectionnel_t × bps/10000 ; net_t = brut_t − coût_t ; métriques recalculées sur la série nette.`,
);
console.log(`  → ${path.relative(ROOT, OUT)}/`);
process.exit(0);

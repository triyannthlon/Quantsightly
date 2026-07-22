// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN « 4 Quadrants vs Browne » — référence sur pays réels (US/FR/JP/BR).
// Charge signal + perf via le service 4Q, puis fait tourner le moteur de comparaison
// PUR (`computeModelComparison`) sur les 4 périodes × {nominal, réel} × 25 bps. Écrit
// golden.json + golden-report.md. LECTURE SEULE (aucune écriture base). Public = v2.
//   pnpm exec tsx experiments/4q-vs-browne/golden.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const envf = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = envf
  .split(/\r?\n/)
  .find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length)
  .trim()
  .replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);

const db: any = await imp("src/lib/coredata/db.ts");
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const mc: any = await imp("src/lib/coredata/model-comparison/index.ts");
const fq: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const { computeModelComparison, PUBLIC_STRATEGY_IDS } = mc;
const { REALLOCATION_BAND } = fq;

const COUNTRIES = ["US", "FR", "JP", "BR"];
const PERIODS: Record<string, number | null> = { MAX: null, "20A": 20, "10A": 10, "5A": 5 };
const MODES = ["nominal", "real"] as const;
const COST_BPS = 25;

const r2 = (v: number | null | undefined) =>
  v === null || v === undefined ? null : Math.round(v * 100) / 100;

/** Sous-ensemble de métriques figées dans le golden. */
function pick(m: any) {
  if (!m) return null;
  return {
    months: m.months,
    start: m.start.slice(0, 7),
    end: m.end.slice(0, 7),
    cumulative: r2(m.cumulative),
    annualized: r2(m.annualized),
    volatility: r2(m.volatility),
    sharpe: r2(m.sharpe),
    sortino: r2(m.sortino),
    maxDrawdown: r2(m.maxDrawdown),
    maxUnderwaterMonths: m.maxUnderwaterMonths,
    worstRolling12m: r2(m.worstRolling12m),
    es95: r2(m.expectedShortfall95),
    es99: r2(m.expectedShortfall99),
    annualizedTurnover: r2(m.annualizedTurnover),
    reallocationsPerYear: r2(m.reallocationsPerYear),
    cumulativeCost: r2(m.cumulativeCost),
  };
}

const golden: Record<string, any> = {};
const O: string[] = [];
const P = (s = "") => O.push(s);

P("# Golden — 4 Quadrants vs Browne (US/FR/JP/BR)\n");
P(`Moteur de comparaison PUR, public = \`4q-standard-v2\` (bande δ=5), coûts **${COST_BPS} bps** sur rotation exécutée, aucune poche Énergie. Observation LECTURE SEULE.\n`);

// Contrôle transverse : le 4Q contraint-il bien la fenêtre commune ?
P("## Contrôle « fenêtre commune stricte » (mode nominal, Max)\n");
P("| pays | Browne seul (mois) | 3 stratégies (mois) | début commun | dates identiques |");
P("|---|---|---|---|---|");

for (const code of COUNTRIES) {
  const model = await svc.getCountryQuadrantModel(code);
  const shared = {
    countryCode: code,
    signal: model.signal,
    perf: model.perf,
    transitionWidth: 20,
    reallocationBand: REALLOCATION_BAND.v2,
  };

  const browneOnly = computeModelComparison(shared, { strategyIds: ["browne"], period: null, mode: "nominal", costBps: COST_BPS });
  const allMax = computeModelComparison(shared, { period: null, mode: "nominal", costBps: COST_BPS });
  const avail = allMax.strategies.filter((s: any) => s.availability.status === "ok");
  const dateSets = avail.map((s: any) => s.cumulativeSeries.map((p: any) => p.date).join(","));
  const identical = dateSets.every((d: string) => d === dateSets[0]);
  P(
    `| ${code} | ${browneOnly.window?.months ?? "—"} | ${allMax.window?.months ?? "—"} | ${allMax.window?.start ?? "—"} | ${identical ? "✅" : "❌"} |`,
  );

  for (const mode of MODES) {
    for (const [pname, years] of Object.entries(PERIODS)) {
      const r = computeModelComparison(shared, { period: years, mode, costBps: COST_BPS });
      const key = `${code}|${mode}|${pname}`;
      golden[key] = {
        window: r.window,
        disabledReason: r.disabledReason,
        strategies: Object.fromEntries(
          r.strategies.map((s: any) => [
            s.id,
            {
              availability: s.availability,
              metrics: pick(s.metrics),
            },
          ]),
        ),
      };
    }
  }
}

// Tableaux lisibles : nominal Max + réel Max par pays.
for (const mode of MODES) {
  P(`\n## Comparaison — mode ${mode === "nominal" ? "Nominal" : "Réel"}, Max, ${COST_BPS} bps\n`);
  for (const code of COUNTRIES) {
    const g = golden[`${code}|${mode}|MAX`];
    if (!g || g.disabledReason) {
      P(`### ${code} — indisponible (${g?.disabledReason ?? "?"})\n`);
      continue;
    }
    P(`### ${code} — fenêtre ${g.window.start} → ${g.window.end} (${g.window.months} mois)\n`);
    P("| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |");
    P("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const id of PUBLIC_STRATEGY_IDS) {
      const s = g.strategies[id];
      const m = s?.metrics;
      const lbl = fq && id; // label simple
      if (!m) {
        P(`| ${id} | — indisponible (${s?.availability?.reason ?? "?"}) |`);
        continue;
      }
      P(
        `| ${id} | ${m.cumulative} | ${m.annualized} | ${m.volatility} | ${m.sharpe} | ${m.sortino ?? "—"} | ${m.maxDrawdown} | ${m.maxUnderwaterMonths} | ${m.worstRolling12m} | ${m.es95} | ${m.annualizedTurnover} | ${m.reallocationsPerYear} | ${m.cumulativeCost} |`,
      );
    }
    P("");
  }
}

mkdirSync(HERE, { recursive: true });
writeFileSync(path.join(HERE, "golden.json"), JSON.stringify(golden, null, 2));
writeFileSync(path.join(HERE, "golden-report.md"), O.join("\n"));
await db.coredataPool?.end?.();
console.log("✅ golden.json + golden-report.md écrits");
console.log(O.join("\n"));

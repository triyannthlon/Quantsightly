// ─────────────────────────────────────────────────────────────────────────────
// ÉTUDE ÉNERGIE — exploration systématique (LECTURE SEULE, moteur non modifié).
//
// Question de recherche : « Existe-t-il une manière robuste d'ajouter une poche
// Énergie qui améliore DURABLEMENT le modèle 4Q ? » (pas « est-ce que 10 % marche ? »).
//
// Principe : la poche Énergie = famille paramétrée appliquée APRÈS l'allocation cœur
// du moteur FIGÉ (`buildModel`), financée selon 3 méthodes, testée sur toute la grille.
// La cellule w_max=0 REPRODUIT le socle `4q-standard-v1` sur la même fenêtre (témoin).
//
//   Perf poche Énergie = MSCI World Energy TR (`MXWO0EN Index-XX-1-2`), converti en
//   devise locale comme l'or. JAMAIS le WTI générique (roll ignoré, cf. audit).
//
// Sorties : results.json (agrégats) + results-tables.md (cartes de plateau).
// Lance : pnpm exec tsx experiments/4q-energie/study.mts        (complet, ~plusieurs min)
//         CALIB=1 pnpm exec tsx experiments/4q-energie/study.mts (1 pays, validation)
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
const envLine = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="));
process.env.CODEDATA_DATABASE_URL = envLine!.slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");

const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const db: any = await imp("src/lib/coredata/db.ts");
const compute: any = await imp("src/lib/coredata/compute.ts");
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const fq: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const { buildModel, backtestQuadrants, weightsFromModel } = fq;

const CALIB = process.env.CALIB === "1";

// ─── Espace de paramètres ────────────────────────────────────────────────────
const W_MAX = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]; // 0 = témoin (socle)
const T_E = [0, 10, 20, 30, 40, 50]; // seuil d'activation Énergie (coords)
const SHAPES = ["step", "ramp"] as const; // fixe / progressive
const FINANCE = ["prorata", "boombloc", "cash"] as const;
const STRATS = ["dynamic", "binary"] as const;
const T_MODEL = [0, 20, 50]; // largeur zone neutre du moteur
const HORIZONS: Array<{ key: string; years: number | null }> = [
  { key: "Max", years: null }, // = commun 1995→ (plancher Énergie)
  { key: "20A", years: 20 },
  { key: "10A", years: 10 },
  { key: "5A", years: 5 },
];
const COST_BPS = [10, 25, 50];
const ENERGY_ID = "MXWO0EN Index-XX-1-2"; // MSCI World Energy TR
const EXCLUDE = new Set(["DK"]); // 21 mois → bruit

type Shape = (typeof SHAPES)[number];
type Fin = (typeof FINANCE)[number];

// ─── Overlay Énergie (famille paramétrée) ────────────────────────────────────
/** Poids Énergie brut ∈ [0,1] à partir des coords (gate boom : x>0 ET y>0). */
function energyRaw(x: number, y: number, shape: Shape, tE: number): number {
  if (x <= 0 || y <= 0) return 0;
  const m = Math.min(x, y); // les DEUX signaux requis
  if (shape === "step") return m >= tE ? 1 : 0;
  if (m <= tE) return 0;
  return Math.min(1, (m - tE) / (100 - tE)); // ramp linéaire tE→100
}

interface Core {
  equities: number;
  bonds: number;
  gold: number;
  cash: number;
}
interface Final extends Core {
  energy: number;
}

/** Finance le poids Énergie `e` selon la méthode ; jamais négatif, somme = 1. */
function finance(base: Core, e0: number, method: Fin): Final {
  const e = Math.max(0, Math.min(0.95, e0));
  if (e === 0) return { ...base, energy: 0 };
  if (method === "prorata") {
    const k = 1 - e;
    return { equities: base.equities * k, bonds: base.bonds * k, gold: base.gold * k, cash: base.cash * k, energy: e };
  }
  if (method === "boombloc") {
    const s = base.equities + base.gold;
    if (s <= 1e-9) {
      const k = 1 - e; // repli prorata si le bloc boom est vide
      return { equities: base.equities * k, bonds: base.bonds * k, gold: base.gold * k, cash: base.cash * k, energy: e };
    }
    const eEff = Math.min(e, s);
    const k = 1 - eEff / s;
    return { equities: base.equities * k, bonds: base.bonds, gold: base.gold * k, cash: base.cash, energy: eEff };
  }
  // cash : prélève sur le cash, déborde au prorata des trois autres poches.
  const eCash = Math.min(e, base.cash);
  const r = e - eCash;
  let eq = base.equities, bd = base.bonds, gd = base.gold;
  const rest = eq + bd + gd;
  if (r > 1e-12 && rest > 1e-9) {
    const k = 1 - r / rest;
    eq *= k; bd *= k; gd *= k;
  }
  return { equities: eq, bonds: bd, gold: gd, cash: base.cash - eCash, energy: e };
}

// ─── Stats ───────────────────────────────────────────────────────────────────
const median = (a: number[]) => quantile(a, 0.5);
function quantile(arr: number[], q: number): number {
  const a = arr.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const i = (a.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? a[lo] : a[lo] + (a[hi] - a[lo]) * (i - lo);
}
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
/** Pire décile (moyenne des ~10 % plus bas, min 1). */
function worstDecile(a: number[]): number {
  const s = a.filter(Number.isFinite).sort((x, y) => x - y);
  if (!s.length) return NaN;
  const n = Math.max(1, Math.round(s.length * 0.1));
  return mean(s.slice(0, n));
}

// ─── Chargement des données (une fois) ───────────────────────────────────────
console.error("Chargement des données…");
const fxRates: any[] = await db.getFxRates();
const usdPerUnit = new Map<string, Map<string, number>>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyRawUsd: any[] = await db.getSeriesData(ENERGY_ID);
function toLocal(data: any[], target: string): any[] {
  if (!target || target === "USD") return data;
  const tgt = usdPerUnit.get(target) ?? null;
  if (!tgt) return data; // pas de FX → laissé en USD (ne devrait pas arriver)
  return compute.convertCurrency(data, null, tgt);
}

let countries: Array<{ iso: string }> = await svc.listQuadrantCountries();
countries = countries.filter((c) => !EXCLUDE.has(c.iso));
if (CALIB) countries = countries.filter((c) => c.iso === "US");

interface Loaded {
  code: string;
  currency: string;
  signal: any;
  perf: any;
  energyLocal: any[];
}
const loaded: Loaded[] = [];
for (const { iso } of countries) {
  const cm = await svc.getCountryQuadrantModel(iso);
  if (!cm.config || !cm.signal || !cm.perf) continue;
  loaded.push({
    code: iso,
    currency: cm.config.currency,
    signal: cm.signal,
    perf: cm.perf,
    energyLocal: toLocal(energyRawUsd, cm.config.currency),
  });
}
console.error(`  ${loaded.length} pays chargés.`);

// ─── Métriques d'un backtest ─────────────────────────────────────────────────
interface Cell {
  realCAGR: number | null;
  realVol: number | null;
  realMDD: number | null;
  realSharpe: number | null;
  underwater: number | null;
  turnover: number | null; // annualisé (fraction)
  energyShare: number; // part des mois avec Énergie > 0 (fenêtre)
  energySwitches: number; // bascules on/off par an
  energyContrib: number | null; // contribution propre cumulée (%)
  months: number;
  ok: boolean;
}

function runCell(l: Loaded, model: any, shape: Shape | null, tE: number, wMax: number, method: Fin, years: number | null): Cell {
  // Poids : overlay Énergie appliqué à baseAllocation de chaque mois.
  const results = model.monthlyResults as any[];
  let activeMonthsAll = 0;
  const weights = results.map((r) => {
    const e = wMax === 0 || shape === null ? 0 : wMax * energyRaw(r.x, r.y, shape, tE);
    if (e > 0) activeMonthsAll++;
    return { date: r.date, allocation: finance(r.baseAllocation, e, method) };
  });

  const bt = backtestQuadrants({
    countryCode: l.code,
    weights,
    equityTotalReturn: l.perf.equityTotalReturn,
    bondTotalReturn: l.perf.bondTotalReturn,
    cashTotalReturn: l.perf.cashTotalReturn,
    gold: l.perf.gold,
    energyTotalReturn: l.energyLocal, // toujours passé → fenêtre commune 1995→
    cpi: l.perf.cpi,
    windowYears: years,
  });
  if (bt.status !== "OK") {
    return { realCAGR: null, realVol: null, realMDD: null, realSharpe: null, underwater: null, turnover: null, energyShare: 0, energySwitches: 0, energyContrib: null, months: 0, ok: false };
  }

  // Part & bascules Énergie SUR LA FENÊTRE effective (start..end).
  const wByMonth = new Map(weights.map((w: any) => [w.date.slice(0, 7), w.allocation.energy]));
  const startM = bt.start.slice(0, 7), endM = bt.end.slice(0, 7);
  let active = 0, total = 0, switches = 0, prevActive: boolean | null = null;
  for (const r of results) {
    const m = r.date.slice(0, 7);
    if (m < startM || m > endM) continue;
    const on = (wByMonth.get(m) ?? 0) > 1e-9;
    total++; if (on) active++;
    if (prevActive !== null && on !== prevActive) switches++;
    prevActive = on;
  }
  const years_ = total > 1 ? total / 12 : 1;
  const real = bt.metrics.real;
  return {
    realCAGR: real?.annualized ?? null,
    realVol: real?.volatility ?? null,
    realMDD: real?.maxDrawdown ?? null,
    realSharpe: real?.sharpe ?? null,
    underwater: real?.maxUnderwaterMonths ?? null,
    turnover: bt.turnover.annualized,
    energyShare: total ? active / total : 0,
    energySwitches: switches / years_,
    energyContrib: bt.contributions?.energy ?? null,
    months: bt.metrics.nominal.months,
    ok: real != null,
  };
}

/** Rendement/Sharpe réels NET de coûts (drag analytique = bps·2·turnover). */
function net(cell: Cell, bps: number): { cagr: number | null; sharpe: number | null } {
  if (cell.realCAGR == null || cell.turnover == null) return { cagr: null, sharpe: null };
  const drag = (bps / 10000) * 2 * cell.turnover * 100; // %/an
  const cagr = cell.realCAGR - drag;
  const sharpe = cell.realSharpe != null && cell.realVol ? cell.realSharpe - drag / cell.realVol : null;
  return { cagr, sharpe };
}

// ─── Balayage ────────────────────────────────────────────────────────────────
const strats = CALIB ? (["dynamic"] as const) : STRATS;
const tModels = CALIB ? [20] : T_MODEL;

interface AggKey { strategy: string; T: number; horizon: string; shape: Shape; fin: Fin; wMax: number; tE: number; }
interface AggRow extends AggKey {
  n: number;
  // Δ vs témoin (par pays) → stats de robustesse
  dSharpe25: { med: number; q1: number; q3: number; worst: number; pImp: number };
  dCAGR25: { med: number; q1: number; q3: number; worst: number };
  dMDD: { med: number; q1: number; q3: number; worst: number };
  dTurnover: { med: number; q1: number; q3: number };
  energyShare: number; // médiane
  energySwitches: number; // médiane
  energyContrib: number; // médiane
  // Absolus (médianes) pour référence
  absSharpe25: number;
}

const t0 = Date.now();
let btCount = 0;
const rows: AggRow[] = [];

for (const strategy of strats) {
  for (const T of tModels) {
    // Modèle FIGÉ par (pays, stratégie, T) — construit une fois.
    const models = loaded.map((l) => ({ l, model: buildModel(l.signal, { ...fq.DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy, transitionWidth: T, energyMode: "disabled" }) }))
      .filter((m) => m.model.status === "OK");

    for (const horizon of HORIZONS) {
      // Témoin (w_max=0) par pays → référence des Δ.
      const ref = new Map<string, Cell>();
      for (const { l, model } of models) {
        ref.set(l.code, runCell(l, model, null, 0, 0, "prorata", horizon.years));
        btCount++;
      }

      for (const shape of SHAPES) {
        for (const fin of FINANCE) {
          for (const wMax of W_MAX) {
            if (wMax === 0) continue; // témoin déjà couvert
            for (const tE of T_E) {
              const dS: number[] = [], dC: number[] = [], dM: number[] = [], dT: number[] = [];
              const shareA: number[] = [], switchA: number[] = [], contribA: number[] = [], absS: number[] = [];
              let imp = 0, n = 0;
              for (const { l, model } of models) {
                const r0 = ref.get(l.code)!;
                if (!r0.ok) continue;
                const c = runCell(l, model, shape, tE, wMax, fin, horizon.years);
                btCount++;
                if (!c.ok) continue;
                const n0 = net(r0, 25), n1 = net(c, 25);
                if (n1.sharpe == null || n0.sharpe == null) continue;
                const ds = n1.sharpe - n0.sharpe;
                dS.push(ds);
                dC.push((n1.cagr ?? 0) - (n0.cagr ?? 0));
                dM.push((c.realMDD ?? 0) - (r0.realMDD ?? 0)); // + = MDD moins profond (meilleur)
                dT.push((c.turnover ?? 0) - (r0.turnover ?? 0));
                shareA.push(c.energyShare); switchA.push(c.energySwitches);
                contribA.push(c.energyContrib ?? 0); absS.push(n1.sharpe);
                if (ds > 0) imp++;
                n++;
              }
              if (!n) continue;
              rows.push({
                strategy, T, horizon: horizon.key, shape, fin, wMax, tE, n,
                dSharpe25: { med: median(dS), q1: quantile(dS, 0.25), q3: quantile(dS, 0.75), worst: worstDecile(dS), pImp: imp / n },
                dCAGR25: { med: median(dC), q1: quantile(dC, 0.25), q3: quantile(dC, 0.75), worst: worstDecile(dC) },
                dMDD: { med: median(dM), q1: quantile(dM, 0.25), q3: quantile(dM, 0.75), worst: worstDecile(dM) },
                dTurnover: { med: median(dT), q1: quantile(dT, 0.25), q3: quantile(dT, 0.75) },
                energyShare: median(shareA), energySwitches: median(switchA), energyContrib: median(contribA),
                absSharpe25: median(absS),
              });
            }
          }
        }
      }
    }
    console.error(`  ${strategy}/T${T} — ${btCount} backtests, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}

console.error(`\nTerminé : ${btCount} backtests en ${((Date.now() - t0) / 1000).toFixed(0)}s.`);

// ─── Calibration : vérifier que w_max=0 reproduit le socle ───────────────────
if (CALIB) {
  const l = loaded[0];
  const model = buildModel(l.signal, { ...fq.DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  // Socle réel = backtest SANS énergie, historique complet (comme le service).
  const socle = backtestQuadrants({ countryCode: l.code, weights: weightsFromModel(model), equityTotalReturn: l.perf.equityTotalReturn, bondTotalReturn: l.perf.bondTotalReturn, cashTotalReturn: l.perf.cashTotalReturn, gold: l.perf.gold, cpi: l.perf.cpi, windowYears: null });
  // Témoin de l'étude = w_max=0 AVEC énergie passée (fenêtre 1995→).
  const witness = runCell(l, model, null, 0, 0, "prorata", null);
  console.error("\n── CALIBRATION (US, dynamique, T=20) ──");
  console.error(`  Socle Max (sans énergie)  : CAGR réel ${socle.status === "OK" ? socle.metrics.real?.annualized?.toFixed(2) : "?"} %, ${socle.status === "OK" ? socle.metrics.nominal.months : "?"} mois, start ${socle.status === "OK" ? socle.start : "?"}`);
  console.error(`  Témoin 1995→ (w_max=0)    : CAGR réel ${witness.realCAGR?.toFixed(2)} %, ${witness.months} mois`);
  console.error("  (les deux diffèrent par la seule fenêtre : socle=1985→, témoin=1995→ — normal)");
  // Sanity : une config Énergie franche.
  const sample = runCell(l, model, "step", 20, 0.15, "prorata", null);
  console.error(`  Ex. step T_E=20 w_max=15% prorata : CAGR ${sample.realCAGR?.toFixed(2)} %, Sharpe ${sample.realSharpe?.toFixed(3)}, part Énergie ${(sample.energyShare * 100).toFixed(0)} %, contrib ${sample.energyContrib?.toFixed(1)} %, rotation ${(sample.turnover! * 100).toFixed(0)} %/an`);
}

// ─── Export ──────────────────────────────────────────────────────────────────
writeFileSync(path.join(HERE, CALIB ? "results-calib.json" : "results.json"), JSON.stringify(rows, null, 0));
console.error(`\nÉcrit : ${CALIB ? "results-calib.json" : "results.json"} (${rows.length} cellules agrégées).`);

// ─── Cartes de plateau (markdown) — tranche primaire dynamique / prorata ──────
if (!CALIB) {
  const md: string[] = ["# Étude Énergie — cartes de robustesse (généré par study.mts)\n"];
  md.push(`Panel : ${loaded.length} pays (DK exclu). Δ vs témoin w_max=0, **net 25 bps**. ` +
    `ΔSharpe réel : médiane / (% pays améliorés). Plateau = zone contiguë positive stable.\n`);
  const fmt = (r: AggRow | undefined) => r ? `${r.dSharpe25.med >= 0 ? "+" : ""}${r.dSharpe25.med.toFixed(3)} (${(r.dSharpe25.pImp * 100).toFixed(0)}%)` : "—";
  for (const strategy of STRATS) {
    for (const shape of SHAPES) {
      for (const fin of FINANCE) {
        for (const horizon of HORIZONS) {
          const slice = rows.filter((r) => r.strategy === strategy && r.T === 20 && r.shape === shape && r.fin === fin && r.horizon === horizon.key);
          if (!slice.length) continue;
          md.push(`\n### ${strategy} · T=20 · ${shape} · ${fin} · ${horizon.key}\n`);
          md.push("| T_E \\ w_max | " + W_MAX.filter((w) => w > 0).map((w) => `${(w * 100).toFixed(0)}%`).join(" | ") + " |");
          md.push("|" + "---|".repeat(W_MAX.filter((w) => w > 0).length + 1));
          for (const tE of T_E) {
            const cells = W_MAX.filter((w) => w > 0).map((w) => fmt(slice.find((r) => r.wMax === w && r.tE === tE)));
            md.push(`| **${tE}** | ${cells.join(" | ")} |`);
          }
        }
      }
    }
  }
  writeFileSync(path.join(HERE, "results-tables.md"), md.join("\n"));
  console.error("Écrit : results-tables.md");

  // Top plateaux : cellules dont la médiane ET les 4 voisines directes sont > 0 (Max, dynamique).
  console.error("\n── Meilleures cellules (dynamique, Max, net 25 bps, tri médiane ΔSharpe) ──");
  const maxDyn = rows.filter((r) => r.strategy === "dynamic" && r.T === 20 && r.horizon === "Max")
    .sort((a, b) => b.dSharpe25.med - a.dSharpe25.med).slice(0, 12);
  for (const r of maxDyn) {
    console.error(`  ${r.shape}/${r.fin} T_E=${r.tE} w=${(r.wMax * 100).toFixed(0)}% : ΔSharpe ${r.dSharpe25.med >= 0 ? "+" : ""}${r.dSharpe25.med.toFixed(3)} [q1 ${r.dSharpe25.q1.toFixed(3)}/q3 ${r.dSharpe25.q3.toFixed(3)}/pire ${r.dSharpe25.worst.toFixed(3)}] ` +
      `%imp ${(r.dSharpe25.pImp * 100).toFixed(0)} | ΔMDD ${r.dMDD.med >= 0 ? "+" : ""}${r.dMDD.med.toFixed(1)} | Δrot +${(r.dTurnover.med * 100).toFixed(0)}pt | partÉ ${(r.energyShare * 100).toFixed(0)}%`);
  }
}

await db.coredataPool?.end?.();
console.error("\n✅ Étude terminée.");

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT A — reconstruction INDÉPENDANTE (LECTURE SEULE). Vérifie que les résultats
// exceptionnellement homogènes ne proviennent pas d'un artefact de calcul.
//
// Pour un échantillon (US, FR, JP, BR, CN × dynamic/binary × commun/10a/5a), on recalcule
// À LA MAIN, à partir des seules séries mensuelles renvoyées par `computeEnergyLabComparison`,
// perf cumulée/annualisée, volatilité, Sharpe, max drawdown, rotation et l'écart socle/Énergie,
// puis on compare au pipeline (`lab-window-metrics`). ÉCHOUE au-delà d'une tolérance documentée.
// Ne modifie NI moteur NI données. N'écrit rien (rapport console).
//   pnpm exec tsx experiments/4q-energy-lab/audit-reconstruction.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
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

// Tolérances DOCUMENTÉES (le contrôle échoue au-delà).
const ABS_TOL = 1e-6; // points de % / mois entiers
const RATIO_TOL = 1e-9; // Sharpe, Calmar

const SAMPLE = ["US", "FR", "JP", "BR", "CN"];
const STRATS = ["dynamic", "binary"] as const;
const PERIODS = [
  { key: "common", years: null as number | null },
  { key: "10y", years: 10 },
  { key: "5y", years: 5 },
];
const MODES = ["nominal", "real"] as const;

const mk = (d: string) => d.slice(0, 7);
const maxMonth = (a: string, b: string) => (a >= b ? a : b);
const minMonth = (a: string, b: string) => (a <= b ? a : b);
let pass = 0;
let failCount = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) pass++;
  else {
    failCount++;
    failures.push(`${name}${detail ? " — " + detail : ""}`);
    console.log(`  ❌ ${name}${detail ? " — " + detail : ""}`);
  }
};
const near = (a: number | null, b: number | null, tol: number) =>
  a === null || b === null ? a === b : Math.abs(a - b) <= tol * (1 + Math.abs(b));

// ── Recalculs INDÉPENDANTS (implémentation distincte de lab-window-metrics) ─────
type Pt = { date: string; value: number };
const clip = (s: Pt[], a: string, b: string) => s.filter((p) => mk(p.date) >= a && mk(p.date) <= b);
const monthlyReturns = (s: Pt[]) => s.slice(1).map((p, i) => p.value / s[i].value - 1);
function indepAnnualized(s: Pt[]): number | null {
  if (s.length < 2) return null;
  const f = s[0].value;
  const l = s[s.length - 1].value;
  if (f <= 0 || l <= 0) return null;
  return (Math.pow(l / f, 12 / (s.length - 1)) - 1) * 100;
}
function indepVol(s: Pt[]): number | null {
  const r = monthlyReturns(s);
  if (r.length < 2) return null;
  const m = r.reduce((x, y) => x + y, 0) / r.length;
  const v = r.reduce((x, y) => x + (y - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v) * Math.sqrt(12) * 100;
}
function indepMaxDD(s: Pt[]): number | null {
  if (s.length < 2) return null;
  let peak = -Infinity;
  let mdd = 0;
  for (const p of s) {
    if (p.value > peak) peak = p.value;
    if (peak > 0) mdd = Math.min(mdd, (p.value / peak - 1) * 100);
  }
  return mdd;
}
function indepRotation(monthly: any[], a: string, b: string): number | null {
  const v = monthly
    .filter((t) => mk(t.date) > a && mk(t.date) <= b && t.turnover !== null)
    .map((t) => t.turnover);
  return v.length ? (v.reduce((x: number, y: number) => x + y, 0) / v.length) * 12 : null;
}

console.log(
  "# AUDIT A — reconstruction indépendante (tol abs " + ABS_TOL + ", ratio " + RATIO_TOL + ")\n",
);

for (const iso of SAMPLE) {
  for (const strat of STRATS) {
    for (const p of PERIODS) {
      const cmp = await svc.computeEnergyLabComparison(iso, strat, undefined, p.years);
      if (!cmp) {
        check(`${iso}:${strat}:${p.key} comparaison non nulle`, false);
        continue;
      }
      for (const mode of MODES) {
        const stdS: Pt[] =
          mode === "real"
            ? cmp.standard.backtest.series.real
            : cmp.standard.backtest.series.nominal;
        const enS: Pt[] =
          mode === "real" ? cmp.energy.backtest.series.real : cmp.energy.backtest.series.nominal;
        const tag = `${iso}:${strat}:${p.key}:${mode}`;
        if (!stdS || !enS) {
          check(`${tag} séries présentes`, false);
          continue;
        }
        const aStart = maxMonth(mk(stdS[0].date), mk(enS[0].date));
        const aEnd = minMonth(mk(stdS[stdS.length - 1].date), mk(enS[enS.length - 1].date));
        const stdC = clip(stdS, aStart, aEnd);
        const enC = clip(enS, aStart, aEnd);

        // Propriété : mêmes dates exactes socle/variante.
        check(
          `${tag} mêmes dates`,
          stdC.length === enC.length && stdC.every((p2, i) => p2.date === enC[i].date),
          `${stdC.length} vs ${enC.length}`,
        );

        // Propriété : rendement initial ni doublé ni omis (cumul = produit des rendements).
        for (const [lab, s] of [
          ["socle", stdC],
          ["énergie", enC],
        ] as const) {
          const cumProd = (monthlyReturns(s).reduce((acc, r) => acc * (1 + r), 1) - 1) * 100;
          const cumRatio = (s[s.length - 1].value / s[0].value - 1) * 100;
          check(
            `${tag} ${lab} cumul cohérent (produit=ratio)`,
            near(cumProd, cumRatio, ABS_TOL),
            `${cumProd} vs ${cumRatio}`,
          );
        }

        // riskFree indépendant (nominal : depuis sleeves.cash) ; officiel : déduit des métriques Énergie.
        const enMetrics =
          mode === "real" ? cmp.energy.backtest.metrics.real : cmp.energy.backtest.metrics.nominal;
        const rfOfficial = wm.riskFreeFromMetrics(enMetrics);
        let rfIndep: number | null = null;
        if (mode === "nominal") {
          const cash: Pt[] = clip(cmp.energy.backtest.series.sleeves.cash, aStart, aEnd);
          rfIndep = indepAnnualized(cash);
          // Propriété : le cash du Sharpe correspond EXACTEMENT à la fenêtre analysée.
          check(
            `${tag} cash(Sharpe) = cash de la fenêtre`,
            near(rfIndep, rfOfficial, ABS_TOL),
            `indep ${rfIndep} vs officiel ${rfOfficial}`,
          );
        }

        // Reconstruction numérique vs pipeline (windowMetrics), pour chaque variante.
        for (const [lab, sC, variant] of [
          ["socle", stdC, cmp.standard],
          ["énergie", enC, cmp.energy],
        ] as const) {
          const off = wm.windowMetrics(
            mode === "real" ? variant.backtest.series.real : variant.backtest.series.nominal,
            aStart,
            aEnd,
            rfOfficial,
          );
          check(
            `${tag} ${lab} annualisée`,
            near(indepAnnualized(sC), off.annualized, ABS_TOL),
            `${indepAnnualized(sC)} vs ${off.annualized}`,
          );
          check(
            `${tag} ${lab} volatilité`,
            near(indepVol(sC), off.volatility, ABS_TOL),
            `${indepVol(sC)} vs ${off.volatility}`,
          );
          check(
            `${tag} ${lab} maxDD`,
            near(indepMaxDD(sC), off.maxDrawdown, ABS_TOL),
            `${indepMaxDD(sC)} vs ${off.maxDrawdown}`,
          );
          const iv = indepVol(sC);
          const ia = indepAnnualized(sC);
          const rf = mode === "nominal" ? rfIndep : rfOfficial; // réel : cash non exposé, on réutilise l'officiel
          const sharpeIndep =
            ia !== null && iv !== null && iv > 0 && rf !== null ? (ia - rf) / iv : null;
          check(
            `${tag} ${lab} Sharpe`,
            near(sharpeIndep, off.sharpe, RATIO_TOL),
            `${sharpeIndep} vs ${off.sharpe}`,
          );
          const rotIndep = indepRotation(variant.backtest.turnover.monthly, aStart, aEnd);
          const rotOff = wm.windowTurnoverAnnualized(
            variant.backtest.turnover.monthly,
            aStart,
            aEnd,
          );
          check(
            `${tag} ${lab} rotation`,
            near(rotIndep, rotOff, ABS_TOL),
            `${rotIndep} vs ${rotOff}`,
          );
        }

        // Écart reconstruit = écart pipeline (Sharpe & annualisée).
        const offStd = wm.windowMetrics(
          mode === "real"
            ? cmp.standard.backtest.series.real
            : cmp.standard.backtest.series.nominal,
          aStart,
          aEnd,
          rfOfficial,
        );
        const offEn = wm.windowMetrics(
          mode === "real" ? cmp.energy.backtest.series.real : cmp.energy.backtest.series.nominal,
          aStart,
          aEnd,
          rfOfficial,
        );
        const dAnnIndep = (indepAnnualized(enC) ?? NaN) - (indepAnnualized(stdC) ?? NaN);
        const dAnnOff = (offEn.annualized ?? NaN) - (offStd.annualized ?? NaN);
        check(
          `${tag} Δannualisée reconstruite`,
          near(dAnnIndep, dAnnOff, ABS_TOL),
          `${dAnnIndep} vs ${dAnnOff}`,
        );

        // Propriété : nominal ≠ réel (bonnes séries).
        if (mode === "real") {
          const nomEn: Pt[] = cmp.energy.backtest.series.nominal;
          check(
            `${tag} réel ≠ nominal (séries distinctes)`,
            enS.length !== nomEn.length ||
              enS.some((p2, i) => nomEn[i] && Math.abs(p2.value - nomEn[i].value) > 1e-9),
            "",
          );
        }
      }

      // Propriété : le sous-fenêtrage PRÉSERVE l'état — les rendements mensuels du modèle sur
      // la sous-période sont IDENTIQUES à ceux de la fenêtre commune sur la même plage.
      if (p.years !== null) {
        const common = await svc.computeEnergyLabComparison(iso, strat, undefined, null);
        if (common) {
          for (const which of ["standard", "energy"] as const) {
            const sub: Pt[] = cmp[which].backtest.series.nominal;
            const full: Pt[] = common[which].backtest.series.nominal;
            const a = mk(sub[0].date);
            const b = mk(sub[sub.length - 1].date);
            const rSub = monthlyReturns(clip(sub, a, b));
            const rFull = monthlyReturns(clip(full, a, b));
            const sameLen = rSub.length === rFull.length;
            const sameVals = sameLen && rSub.every((r, i) => Math.abs(r - rFull[i]) <= 1e-9);
            check(
              `${iso}:${strat}:${p.key} ${which} sous-fenêtre = rendements de la fenêtre complète (état préservé)`,
              sameVals,
              sameLen ? "valeurs" : `longueurs ${rSub.length} vs ${rFull.length}`,
            );
          }
        }
      }
    }
  }
}

console.log(
  `\n${failCount === 0 ? "✅ RECONSTRUCTION CONFORME" : "❌ ÉCARTS DÉTECTÉS"} — ${pass} ok / ${failCount} ko`,
);
if (failCount) {
  console.log("\nDétails des écarts :");
  for (const f of failures) console.log("  - " + f);
}
process.exit(failCount === 0 ? 0 : 1);

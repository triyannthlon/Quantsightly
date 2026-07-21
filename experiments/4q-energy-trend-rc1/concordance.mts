// ─────────────────────────────────────────────────────────────────────────────
// `4q-energy-trend-rc1` — HARNAIS DE CONCORDANCE (LECTURE SEULE, prod intacte).
//
// Prouve les 10 points de concordance + tests de frontière, fige les GOLDEN, et écrit
// `concordance-report.md`. La « référence indépendante » = le moteur de production
// `backtestQuadrants` (développé pour v1/v2, non pour cette étude). rc1 = §rc1.ts.
//
//   pnpm exec tsx experiments/4q-energy-trend-rc1/concordance.mts
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { computeTrendSignal, SMA_LOOKBACK_RC1, type SeriesPoint } from "./signal";
import { buildFivePocketTarget, ENERGY_WEIGHT_RC1, type CoreAllocation } from "./portfolio";
import { simulateRc1, measureRc1, activationEpisodes, type Rc1Input, type DataPoint } from "./rc1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const env = readFileSync(path.join(ROOT, ".env"), "utf8");
process.env.CODEDATA_DATABASE_URL = env.split(/\r?\n/).find((l) => l.startsWith("CODEDATA_DATABASE_URL="))!
  .slice("CODEDATA_DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
const imp = (rel: string) => import(pathToFileURL(path.join(ROOT, rel)).href);
const db: any = await imp("src/lib/coredata/db.ts");
const compute: any = await imp("src/lib/coredata/compute.ts");
const svc: any = await imp("src/lib/coredata/four-quadrants-service.ts");
const fq: any = await imp("src/lib/coredata/four-quadrants/index.ts");
const { buildModel, backtestQuadrants, weightsFromModel, DEFAULT_FOUR_QUADRANTS_SETTINGS, REALLOCATION_BAND } = fq;
const BAND: number = REALLOCATION_BAND.v2;
const W = ENERGY_WEIGHT_RC1; // 0.10
const REPS = ["US", "FR", "JP", "BR"]; // USD / EUR / JPY / BRL — devises & historiques variés
const mk = (d: string) => d.slice(0, 7);

// ── Chargement ────────────────────────────────────────────────────────────────
const fxRates: any[] = await db.getFxRates(); const usdPerUnit = new Map<string, any>();
for (const fx of fxRates) usdPerUnit.set(fx.currency, compute.usdPerUnitMap(fx.data, fx.reverse));
const energyUsd: DataPoint[] = (await db.getSeriesData("SPDYENT Index-XX-5-2")).sort((a: DataPoint, b: DataPoint) => a.date.localeCompare(b.date));
const goldUsd: DataPoint[] = await db.getSeriesData("XAU Comdty-XX-5-1");
const convert = (data: DataPoint[], target: string) => (!target || target === "USD") ? data : compute.convertCurrency(data, null, usdPerUnit.get(target) ?? null);
const signal6 = computeTrendSignal(energyUsd, SMA_LOOKBACK_RC1);

interface Country { code: string; currency: string; model: any; perf: any; energyLocal: DataPoint[]; baseByMonth: Map<string, CoreAllocation>; weightsV2: any[]; weightsRc1: (w: number, sig?: Map<string, boolean>) => any[] }
async function loadCountry(iso: string): Promise<Country | null> {
  const cm = await svc.getCountryQuadrantModel(iso);
  if (!cm.config || !cm.signal || !cm.perf) return null;
  const model = buildModel(cm.signal, { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy: "dynamic", transitionWidth: 20, energyMode: "disabled" });
  if (model.status !== "OK") return null;
  const baseByMonth = new Map<string, CoreAllocation>();
  for (const r of model.monthlyResults) baseByMonth.set(mk(r.date), { equities: r.baseAllocation.equities, bonds: r.baseAllocation.bonds, gold: r.baseAllocation.gold, cash: r.baseAllocation.cash });
  const energyLocal = convert(energyUsd, cm.config.currency);
  const weightsRc1 = (w: number, sig: Map<string, boolean> = signal6) => model.monthlyResults.map((r: any) => ({ date: r.date, allocation: buildFivePocketTarget(r.baseAllocation, sig.get(mk(r.date)) ?? false, w) }));
  return { code: iso, currency: cm.config.currency, model, perf: cm.perf, energyLocal, baseByMonth, weightsV2: weightsFromModel(model), weightsRc1 };
}
function rc1InputFor(c: Country, w: number, sig: Map<string, boolean> = signal6): Rc1Input {
  return { countryCode: c.code, baseByMonth: c.baseByMonth, signalByMonth: sig, equityTotalReturn: c.perf.equityTotalReturn, bondTotalReturn: c.perf.bondTotalReturn, cashTotalReturn: c.perf.cashTotalReturn, gold: c.perf.gold, energyLocal: c.energyLocal, cpi: c.perf.cpi, energyWeight: w, reallocationBand: BAND };
}

// ── Cadre de vérification ────────────────────────────────────────────────────
const R: string[] = []; const P = (s = "") => { R.push(s); console.log(s); };
let passN = 0, failN = 0; const fails: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  if (cond) { passN++; P(`  ✅ ${name}${detail ? " — " + detail : ""}`); }
  else { failN++; fails.push(name); P(`  ❌ ${name}${detail ? " — " + detail : ""}`); }
}
/** Rendements mensuels bruts d'un BacktestResult (via la courbe nominale). */
function btMonthly(bt: any): Map<string, number> { const m = new Map<string, number>(); const n = bt.series.nominal; for (let i = 1; i < n.length; i++) m.set(mk(n[i].date), n[i].value / n[i - 1].value - 1); return m; }

const ALL_ISOS: string[] = (await svc.listQuadrantCountries()).map((c: any) => c.iso).filter((c: string) => c !== "DK");
const countries = new Map<string, Country>();
for (const iso of ALL_ISOS) { const c = await loadCountry(iso); if (c) countries.set(iso, c); }

P("# `4q-energy-trend-rc1` — rapport de concordance\n");
P(`Candidat FIGÉ : signal \`SPDYENT_t > SMA${SMA_LOOKBACK_RC1}\`, poids Énergie **${W * 100} %**, financement prorata, UNE bande v2 (δ=5) sur 5 poches, coûts au compounding. Référence indépendante = moteur \`backtestQuadrants\`. ${countries.size} pays.\n`);

// ═══ 10 POINTS DE CONCORDANCE ════════════════════════════════════════════════
P("## Concordance — 10 points");

// (1) w=0 reproduit v2 (allocation v2, Énergie no-op) — bit à bit vs moteur.
P("\n**1. `w=0` reproduit `4q-standard-v2` bit à bit** (Énergie no-op, même fenêtre)");
for (const iso of REPS) {
  const c = countries.get(iso)!;
  const path0 = simulateRc1(rc1InputFor(c, 0));
  const bt = backtestQuadrants({ countryCode: iso, weights: c.weightsV2, ...c.perf, energyTotalReturn: c.energyLocal, windowYears: null, reallocationBand: BAND });
  const btm = btMonthly(bt); let maxErr = 0; for (const s of path0.steps.slice(1)) maxErr = Math.max(maxErr, Math.abs(s.grossReturn - (btm.get(mk(s.date)) ?? NaN)));
  check(`${iso} rc1(w=0)=v2`, maxErr < 1e-9 && path0.status === "OK", `écart max rendement mensuel ${maxErr.toExponential(1)}`);
}

// (2) rc1 (L6/w10) reproduit exactement la référence indépendante (moteur).
P("\n**2. rc1 (L6/w10) reproduit exactement le moteur `backtestQuadrants`** (rendements, rotation, poids finaux)");
for (const iso of REPS) {
  const c = countries.get(iso)!;
  const p = simulateRc1(rc1InputFor(c, W));
  const bt = backtestQuadrants({ countryCode: iso, weights: c.weightsRc1(W), ...c.perf, energyTotalReturn: c.energyLocal, windowYears: null, reallocationBand: BAND });
  const btm = btMonthly(bt); let maxErr = 0; for (const s of p.steps.slice(1)) maxErr = Math.max(maxErr, Math.abs(s.grossReturn - (btm.get(mk(s.date)) ?? NaN)));
  const mm = measureRc1(p, 0, p.steps.length, 0, c.perf.cpi)!;
  const rotErr = Math.abs(mm.rotation - bt.turnover.annualized);
  const heldErr = Math.abs((p.finalHeld?.energy ?? 0) - bt.heldAllocation.energy) + Math.abs((p.finalHeld?.equities ?? 0) - bt.heldAllocation.equities);
  const tgtErr = Math.abs((p.finalTarget?.energy ?? 0) - bt.targetAllocation.energy);
  check(`${iso} rc1=moteur`, maxErr < 1e-9 && rotErr < 1e-9 && heldErr < 1e-9 && tgtErr < 1e-9, `rdt ${maxErr.toExponential(1)} · rot ${rotErr.toExponential(1)} · détenu ${heldErr.toExponential(1)} · cible ${tgtErr.toExponential(1)}`);
}

// (3) aucune info de t+1 dans le signal de t.
P("\n**3. Aucune information de t+1 dans le signal de t** (causalité)");
{
  const cut = "2015-06"; const perturbed = energyUsd.map((p) => (mk(p.date) > cut ? { ...p, value: p.value * 3.7 } : p));
  const sigP = computeTrendSignal(perturbed, 6); let diff = 0; for (const [m, v] of signal6) if (m <= cut && sigP.get(m) !== v) diff++;
  check("signal ≤ t inchangé quand t+1… modifié", diff === 0, `${diff} divergence(s) avant ${cut}`);
}
// (4) première activation seulement après 6 observations valides.
P("\n**4. Première activation possible après 6 observations seulement**");
{
  const months = [...new Set(energyUsd.map((p) => mk(p.date)))].sort();
  const firstSig = [...signal6.keys()].sort()[0];
  check("1er signal = 6ᵉ mois", firstSig === months[5], `1er signal ${firstSig}, 6ᵉ mois ${months[5]}`);
}
// (5) mois manquants/invalides → indisponible, sans interpolation.
P("\n**5. Mois manquant/invalide → signal indisponible (aucune interpolation)**");
{
  // série propre 2000-01..2001-12 avec un TROU en 2000-09.
  const clean: SeriesPoint[] = []; for (let i = 0; i < 24; i++) { const y = 2000 + Math.floor(i / 12), m = i % 12 + 1; if (i === 8) continue; /* trou 2000-09 */ clean.push({ date: `${y}-${String(m).padStart(2, "0")}-28`, value: 100 + i }); }
  const sig = computeTrendSignal(clean, 6);
  const gapAffected = ["2000-09", "2000-10", "2000-11", "2000-12", "2001-01", "2001-02"]; // les 6 fenêtres incluant le trou
  const noneAvailable = gapAffected.every((m) => !sig.has(m));
  const resumes = sig.has("2001-08"); // 6 mois propres après le trou
  // valeur invalide
  const bad = clean.map((p) => (mk(p.date) === "2001-03" ? { ...p, value: -5 } : p));
  const sigBad = computeTrendSignal(bad, 6);
  check("trou → 6 fenêtres indisponibles, reprise ensuite", noneAvailable && resumes, `trou ok=${noneAvailable}, reprise=${resumes}`);
  check("valeur ≤ 0 → mois exclu, pas d'interpolation", !sigBad.has("2001-03"), "");
}
// (6) conversion SPDYENT → locale = convention des autres actifs mondiaux.
P("\n**6. Conversion SPDYENT→locale = convention des autres actifs mondiaux (or)**");
for (const iso of ["FR", "US"]) {
  const c = countries.get(iso)!;
  const eLoc = convert(energyUsd, c.currency); const gLoc = convert(goldUsd, c.currency);
  // même fonction convertCurrency (date exacte) ; USD inchangé, non-USD converti
  const usdIdentity = iso === "US" ? eLoc[0].value === energyUsd[0].value : eLoc[0].value !== energyUsd[0].value;
  const sameLen = eLoc.length === energyUsd.length; // 0 trou après normalisation
  check(`${iso} conversion cohérente (or‖énergie même méthode)`, usdIdentity && sameLen && gLoc.length > 0, `${eLoc.length} pts, USD-identité=${usdIdentity}`);
}
// (7) bande appliquée UNE fois après la cible 5 poches — prouvé par (2).
P("\n**7. Bande appliquée UNE seule fois sur la cible 5 poches** — impliqué par le point 2 (rc1 = moteur, qui applique une bande unique sur les 5 poches).");
check("bande unique (⊂ point 2)", failN === 0 || !fails.some((f) => f.includes("rc1=moteur")), "concordance moteur = bande unique sur 5 poches");
// (8) rotation & coûts uniquement sur transactions exécutées.
P("\n**8. Rotation & coûts uniquement sur transactions exécutées (bande qui bloque = 0 coût)**");
{
  const c = countries.get("US")!; const p = simulateRc1(rc1InputFor(c, W));
  const blocked = p.steps.filter((s, i) => i > 0 && s.turnover === 0); // bande a conservé les poids
  check("mois bloqués par la bande présents (turnover=0, aucun coût)", blocked.length > 0, `${blocked.length} mois conservés`);
  // frontière : w=0.05 → rotation d'activation ≈ bande (0.05). On compte les ACTIVATIONS
  // réellement BLOQUÉES : cible Énergie 5 % mais position exécutée le mois suivant ≈ 0.
  const p5 = simulateRc1(rc1InputFor(c, 0.05));
  let blockedActivations = 0, attempted = 0;
  for (let i = 1; i < p5.steps.length - 1; i++) {
    const justActivated = p5.steps[i].target.energy > 1e-9 && p5.steps[i].held.energy < 1e-9;
    if (justActivated) { attempted++; if (p5.steps[i + 1].held.energy < 0.02) blockedActivations++; }
  }
  const m5 = measureRc1(p5, 0, p5.steps.length, 25, c.perf.cpi)!;
  const pW = measureRc1(p, 0, p.steps.length, 25, c.perf.cpi)!;
  check("frontière w=5 % : activations bloquées par la bande à la frontière δ=5", blockedActivations > 0 && m5.meanEnergyHeld < pW.meanEnergyHeld, `${blockedActivations}/${attempted} activations bloquées · détenu w5 ${(m5.meanEnergyHeld * 100).toFixed(2)}% < w10 ${(pW.meanEnergyHeld * 100).toFixed(2)}%`);
}
// (9) poids détenus/cibles conservés + somme=1 après dérive.
P("\n**9. Poids détenus/cibles conservés, somme = 100 % après dérive**");
{
  let maxSumErr = 0; for (const iso of REPS) { const p = simulateRc1(rc1InputFor(countries.get(iso)!, W)); for (const s of p.steps) { maxSumErr = Math.max(maxSumErr, Math.abs(s.held.equities + s.held.bonds + s.held.gold + s.held.cash + s.held.energy - 1)); maxSumErr = Math.max(maxSumErr, Math.abs(s.target.equities + s.target.bonds + s.target.gold + s.target.cash + s.target.energy - 1)); } }
  check("Σ poids détenus & cibles = 1 (tous mois, tous pays reps)", maxSumErr < 1e-9, `écart max ${maxSumErr.toExponential(1)}`);
}
// (10) déterministe & reproductible.
P("\n**10. Déterministe & reproductible**");
{
  const c = countries.get("US")!; const a = measureRc1(simulateRc1(rc1InputFor(c, W)), 0, simulateRc1(rc1InputFor(c, W)).steps.length, 25, c.perf.cpi)!; const b = measureRc1(simulateRc1(rc1InputFor(c, W)), 0, simulateRc1(rc1InputFor(c, W)).steps.length, 25, c.perf.cpi)!;
  check("deux exécutions identiques", a.realCAGR === b.realCAGR && a.rotation === b.rotation, `CAGR ${a.realCAGR?.toFixed(6)}`);
}

// ═══ TESTS DE FRONTIÈRE ══════════════════════════════════════════════════════
P("\n## Tests de frontière");
{
  // SPDYENT == SMA6 → inactif (strict >)
  const flat: SeriesPoint[] = Array.from({ length: 8 }, (_, i) => ({ date: `2000-${String(i + 1).padStart(2, "0")}-28`, value: 100 }));
  const sigFlat = computeTrendSignal(flat, 6);
  check("SPDYENT = SMA6 → INACTIF (strict >)", sigFlat.get("2000-06") === false && sigFlat.get("2000-07") === false, "série plate → jamais actif");
  // 0→10 et 10→0 présents
  const c = countries.get("US")!; const p = simulateRc1(rc1InputFor(c, W));
  let up = false, down = false; for (let i = 1; i < p.steps.length; i++) { const a = p.steps[i - 1].target.energy, b = p.steps[i].target.energy; if (a < 1e-9 && b > 1e-9) up = true; if (a > 1e-9 && b < 1e-9) down = true; }
  check("transition 0→10 % présente", up); check("transition 10→0 % présente", down);
  // bande bloque vs exécute (activation w=10 franchit la bande)
  const acts = activationEpisodes(p); check("épisodes d'activation détectés", acts.length > 3, `${acts.length} épisodes`);
  // changement simultané alloc nationale + signal : cible = prorata de la NOUVELLE base
  const anyMonth = p.steps.find((s) => s.target.energy > 1e-9 && s.date > "2005-01-01")!;
  const base = c.baseByMonth.get(mk(anyMonth.date))!; const expect = buildFivePocketTarget(base, true, W);
  check("cible = prorata de la base v2 du mois (alloc nat + signal simultanés)", Math.abs(anyMonth.target.equities - expect.equities) < 1e-9, "");
  // données insuffisantes au démarrage
  const shortInput = rc1InputFor(c, W); const tiny = { ...shortInput, equityTotalReturn: c.perf.equityTotalReturn.slice(0, 1) };
  check("données insuffisantes → statut non-OK", simulateRc1(tiny as any).status !== "OK", simulateRc1(tiny as any).status);
  // discontinuité de la série perf DANS la fenêtre consommée (~2010) → NON_CONTIGUOUS
  const gapEq = c.perf.equityTotalReturn.filter((p: any) => p.date.slice(0, 7) !== "2010-06");
  const gapInput = { ...shortInput, equityTotalReturn: gapEq };
  const st = simulateRc1(gapInput as any).status; check("discontinuité perf (2010-06) → NON_CONTIGUOUS_HISTORY", st === "NON_CONTIGUOUS_HISTORY", st);
  // mois de forte variation + conversion : rc1 = moteur tenu (déjà point 2, ici BR très volatil)
  const cbr = countries.get("BR")!; const pbr = simulateRc1(rc1InputFor(cbr, W)); const btbr = backtestQuadrants({ countryCode: "BR", weights: cbr.weightsRc1(W), ...cbr.perf, energyTotalReturn: cbr.energyLocal, windowYears: null, reallocationBand: BAND }); const bm = btMonthly(btbr); let e = 0; for (const s of pbr.steps.slice(1)) e = Math.max(e, Math.abs(s.grossReturn - (bm.get(mk(s.date)) ?? NaN)));
  check("forte variation + conversion (BR) : rc1 = moteur", e < 1e-9, `écart max ${e.toExponential(1)}`);
}

// ═══ GOLDEN ══════════════════════════════════════════════════════════════════
P("\n## Golden fixtures");
const HORIZONS: Array<[string, number | null, string | undefined]> = [["Max", null, undefined], ["20A", 20, undefined], ["10A", 10, undefined], ["5A", 5, undefined], ["Live", null, "2011-02"]];
function fromIdx(steps: any[], years: number | null, fromYm?: string): number { if (fromYm) { const i = steps.findIndex((s: any) => mk(s.date) >= fromYm); return i < 0 ? steps.length - 1 : i; } if (years == null) return 0; const last = steps[steps.length - 1].date; const cut = `${Number(last.slice(0, 4)) - years}${last.slice(4)}`; for (let i = 0; i < steps.length; i++) if (steps[i].date >= cut) return i; return steps.length - 1; }
const round = (v: number | null | undefined, d = 6) => v == null ? null : Number(v.toFixed(d));
const golden: any = { spec: { signal: `SPDYENT>SMA${SMA_LOOKBACK_RC1}`, energyWeight: W, band: BAND, financing: "prorata", strategy: "dynamic", transitionWidth: 20 }, countries: {} };
for (const iso of REPS) {
  const c = countries.get(iso)!; const p = simulateRc1(rc1InputFor(c, W));
  const horizons: any = {};
  for (const [k, y, f] of HORIZONS) { const from = fromIdx(p.steps, y, f); const m = measureRc1(p, from, p.steps.length, 25, c.perf.cpi); horizons[k] = m ? { months: m.months, realCAGR: round(m.realCAGR, 4), realVol: round(m.realVol, 4), realSharpe: round(m.realSharpe, 4), realMDD: round(m.realMDD, 4), underwater: m.underwater, rotation: round(m.rotation, 6), reallocFreq: round(m.reallocFreq, 4), activationRate: round(m.activationRate, 4), meanEnergyHeld: round(m.meanEnergyHeld, 6), totalCost: round(m.totalCost, 4) } : null; }
  const eps = activationEpisodes(p);
  // série mensuelle complète (déterminisme) : date, active, held, target, gross, turnover
  const monthly = p.steps.map((s) => ({ d: s.date.slice(0, 10), a: s.active ? 1 : 0, h: [round(s.held.equities), round(s.held.bonds), round(s.held.gold), round(s.held.cash), round(s.held.energy)], t: [round(s.target.equities), round(s.target.bonds), round(s.target.gold), round(s.target.cash), round(s.target.energy)], g: round(s.grossReturn, 8), k: s.turnover == null ? null : round(s.turnover, 8) }));
  golden.countries[iso] = { currency: c.currency, start: p.start, end: p.end, horizons, episodes: eps, monthly };
}
writeFileSync(path.join(HERE, "golden.json"), JSON.stringify(golden, null, 0));
// replay = déterminisme
let replayOk = true; for (const iso of REPS) { const c = countries.get(iso)!; const p = simulateRc1(rc1InputFor(c, W)); const g = golden.countries[iso]; for (let i = 0; i < p.steps.length; i++) { if (round(p.steps[i].grossReturn, 8) !== g.monthly[i].g) { replayOk = false; break; } } }
check("golden replay déterministe (rendements mensuels identiques)", replayOk, `${REPS.length} pays, série complète figée`);
P(`  Golden figé : ${REPS.join(", ")} — horizons, épisodes, rotation, coûts, série mensuelle (poids détenus/cibles). Épisodes couverts inclus 2007-2009, 2014-2016, 2020-2023, 2025-2026.`);

// ═══ RAPPORT DE COMPARAISON (v2 / rc1 L6w10 / contrôle L6w15 / toujours 10%) ══
P("\n## Comparaison — v2 · rc1 (L6/w10) · contrôle (L6/w15) · Énergie toujours 10 %");
const q = (a: number[], pp: number) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return NaN; const i = (s.length - 1) * pp, lo = Math.floor(i), hi = Math.ceil(i); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo); };
const median = (a: number[]) => q(a, 0.5);
const alwaysSig = new Map<string, boolean>(); for (const m of new Set([...countries.values()].flatMap((c) => [...c.baseByMonth.keys()]))) alwaysSig.set(m, true);
function aggDelta(kind: "rc1" | "ctrl" | "always", from: string, to: string) {
  const dS: number[] = [], dC: number[] = []; for (const c of countries.values()) {
    const wgt = kind === "ctrl" ? 0.15 : W; const sig = kind === "always" ? alwaysSig : signal6;
    const tem = simulateRc1(rc1InputFor(c, 0)); const variant = simulateRc1(rc1InputFor(c, wgt, sig));
    const wb = winIdx(tem, from, to), cb = winIdx(variant, from, to); if (!wb || !cb) continue;
    const m0 = measureRc1(tem, wb[0], wb[1], 25, c.perf.cpi), m1 = measureRc1(variant, cb[0], cb[1], 25, c.perf.cpi);
    if (m0?.realSharpe != null && m1?.realSharpe != null) { dS.push(m1.realSharpe - m0.realSharpe); dC.push((m1.realCAGR ?? 0) - (m0.realCAGR ?? 0)); }
  } return { dS: median(dS), dC: median(dC) };
}
function winIdx(p: any, from: string, to: string): [number, number] | null { const f = p.steps.findIndex((s: any) => mk(s.date) >= from); if (f < 0 || mk(p.steps[f].date) > to) return null; let t = -1; for (let i = p.steps.length - 1; i >= 0; i--) if (mk(p.steps[i].date) <= to) { t = i + 1; break; } return t < 0 || t - f < 3 ? null : [f, t]; }
P("| variante | ΔSharpe Max | ΔCAGR Max | ΔSharpe pré-2021 | ΔSharpe post-lanc |");
P("|---|---|---|---|---|");
for (const [label, kind] of [["**rc1 (L6/w10)**", "rc1"], ["contrôle (L6/w15)", "ctrl"], ["Énergie toujours 10 %", "always"]] as const) {
  const max = aggDelta(kind, "1900-01", "2100-12"), pre = aggDelta(kind, "1900-01", "2020-12"), post = aggDelta(kind, "2011-02", "2100-12");
  P(`| ${label} | ${max.dS >= 0 ? "+" : ""}${max.dS.toFixed(3)} | ${max.dC >= 0 ? "+" : ""}${max.dC.toFixed(2)} | ${pre.dS >= 0 ? "+" : ""}${pre.dS.toFixed(3)} | ${post.dS >= 0 ? "+" : ""}${post.dS.toFixed(3)} |`);
}
P("\n→ La valeur PROPRE du filtre = rc1 − toujours-investi (le filtre récupère la traîne de l'actif brut).");

// ═══ RÉSERVES & PLATEAU ══════════════════════════════════════════════════════
P("\n## Confirmation du plateau & réserves");
P("**Plateau L=4-7 robuste** (cf. `../4q-energie-v2/trend-confirm-report.md`, sans-2021-2022 > 0 sur L=4-7, cassure nette L≥8) — mais **seul L=6/w10 constitue la spec rc1**. `w=15 %` = variante de sensibilité documentée, non retenue comme principale (exposition plus prudente).");
P("\n**Réserves explicites (rappel pour la décision d'intégration ultérieure) :**");
P("- **2021-2022 reste le principal épisode** (≈ 53 % du gain à L=6) ; le résultat **hors 2021-2022 demeure positif**, mais l'épisode pèse.");
P("- **La rotation augmente** (≈ +17 pt/an vs v2, déjà nette de coûts) — surveiller en exécution réelle.");
P("- **Le signal RAPIDE (L≤7) est indispensable** : les filtres lents (L≥8-9) échouent (dominés par 2021-2022).");
P("- **La validation utilise le MÊME historique qui a servi à découvrir l'hypothèse** (L=6 identifié au bord de grille puis confirmé) — pas d'out-of-sample temporel réellement neuf ; prudence.");

P(`\n## Bilan : ${passN} ✅ / ${failN} ❌`);
if (failN) P(`ÉCHECS : ${fails.join(", ")}`);
writeFileSync(path.join(HERE, "concordance-report.md"), R.join("\n"));
await db.coredataPool?.end?.();
console.error(`\n${failN === 0 ? "✅ CONCORDANCE COMPLÈTE" : "⚠️ " + failN + " ÉCHEC(S)"} — concordance-report.md + golden.json`);

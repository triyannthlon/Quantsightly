import type { EconomicDataPoint } from "@/lib/coredata/types";
import type { ComputeBrowneInput, RobustnessBadge } from "@/lib/coredata/browne";
import type { BrowneComparisonRow } from "@/lib/coredata/browne-service";
import type { ChartPoint } from "../../exploration/exploration-chart";

/** Teinte par palier du score de robustesse (partagée Vue pays / Comparaison).
 *  Sobre : fond teinté transparent + bordure discrète + texte coloré. */
export const ROBUSTNESS_TONE: Record<RobustnessBadge, string> = {
  "Très robuste": "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Robuste: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  Moyen: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Fragile: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "Très fragile": "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
};

/** Hex par palier pour les tracés SVG (nuage risque-rendement) — teintes 400, lisibles sur fond sombre. */
export const ROBUSTNESS_HEX: Record<RobustnessBadge, string> = {
  "Très robuste": "#34d399", // emerald-400
  Robuste: "#22d3ee", // cyan-400
  Moyen: "#fbbf24", // amber-400
  Fragile: "#fb923c", // orange-400
  "Très fragile": "#f87171", // red-400
};

// ─── Régions (miroir éditorial de la page Régimes macro, redéfini localement
// pour éviter d'importer le lourd module de carte dans le bundle Browne) ───────

export type BrowneRegion = "monde" | "amerique" | "europe" | "asie";
export type GeoRegion = Exclude<BrowneRegion, "monde">;

export const BROWNE_REGION_ITEMS = [
  { value: "monde", label: "Monde" },
  { value: "amerique", label: "Amérique" },
  { value: "europe", label: "Europe" },
  { value: "asie", label: "Asie-Pacifique" },
];

/** Assignation région par pays (choix éditorial, aligné sur la page Régimes). */
export const COUNTRY_REGION: Record<string, GeoRegion> = {
  US: "amerique", CA: "amerique", MX: "amerique", BR: "amerique",
  DE: "europe", FR: "europe", IT: "europe", ES: "europe",
  GB: "europe", CH: "europe", NO: "europe", SE: "europe", DK: "europe",
  JP: "asie", CN: "asie", KR: "asie", IN: "asie", TW: "asie",
  ID: "asie", AU: "asie", HK: "asie", SG: "asie",
};

/** Teinte par région (couleur alternative des points du nuage). */
export const REGION_HEX: Record<GeoRegion, string> = {
  amerique: "#60a5fa", // blue-400
  europe: "#a78bfa", // violet-400
  asie: "#f472b6", // pink-400
};

export const REGION_LABEL: Record<GeoRegion, string> = {
  amerique: "Amérique",
  europe: "Europe",
  asie: "Asie-Pacifique",
};

export type BrownePeriod = "MAX" | "20A" | "10A" | "5A";
export type BrowneDisplayMode = "nominal" | "real" | "nominal_vs_inflation";

/** Palette STABLE des 4 poches — partagée par les graphes, boutons de séries et « Sources de performance ». */
export const SLEEVE_PALETTE: Record<"equity" | "bond" | "cash" | "gold", string> = {
  equity: "#6C93C7", // Actions — bleu désaturé
  bond: "#4FB6A0", // Obligations — teal / vert doux
  cash: "#94A3B8", // Cash — slate / ardoise
  gold: "#E0A93F", // Or — ambre / or
};

export const PERIOD_ITEMS = [
  { value: "MAX", label: "Max" },
  { value: "20A", label: "20 ans" },
  { value: "10A", label: "10 ans" },
  { value: "5A", label: "5 ans" },
];

export const DISPLAY_ITEMS = [
  { value: "nominal", label: "Nominal" },
  { value: "real", label: "Réel" },
  { value: "nominal_vs_inflation", label: "Nominal vs Inflation" },
];

/** Fin de la fenêtre alignée (min des dernières dates des 4 poches). */
function alignedEnd(input: ComputeBrowneInput): string {
  const lasts = [input.equity, input.bond, input.cash, input.gold]
    .filter((a) => a.length)
    .map((a) => a[a.length - 1].date);
  return lasts.length ? lasts.reduce((a, b) => (a < b ? a : b)) : "";
}

/** Date de début correspondant au preset de période (`null` = MAX / pas de borne). */
export function periodFrom(input: ComputeBrowneInput, period: BrownePeriod): string | null {
  if (period === "MAX") return null;
  const end = alignedEnd(input);
  if (!end) return null;
  const years = period === "20A" ? 20 : period === "10A" ? 10 : 5;
  return `${Number(end.slice(0, 4)) - years}${end.slice(4)}`;
}

/** Restreint les séries de l'input à la période choisie (recalcul sur sous-fenêtre). */
export function filterInput(input: ComputeBrowneInput, period: BrownePeriod): ComputeBrowneInput {
  const from = periodFrom(input, period);
  if (!from) return input;
  const clip = (a: EconomicDataPoint[]) => a.filter((p) => p.date >= from);
  return {
    ...input,
    equity: clip(input.equity),
    bond: clip(input.bond),
    cash: clip(input.cash),
    gold: clip(input.gold),
    inflation: input.inflation ? clip(input.inflation) : undefined,
  };
}

/**
 * Déflate une courbe d'index par l'inflation cumulée (base 100), rebasée 100 à sa
 * 1ʳᵉ date disponible. Sert à obtenir la version « réelle » du benchmark actions.
 */
export function deflate(
  series: EconomicDataPoint[],
  inflationIndex: EconomicDataPoint[] | null,
): EconomicDataPoint[] {
  if (!inflationIndex?.length) return [];
  const cpi = new Map(inflationIndex.map((p) => [p.date.slice(0, 7), p.value]));
  const pts = series
    .map((p) => ({ date: p.date, v: p.value, c: cpi.get(p.date.slice(0, 7)) }))
    .filter((x): x is { date: string; v: number; c: number } => x.c !== undefined && x.c > 0);
  if (pts.length < 2) return [];
  const v0 = pts[0].v;
  const c0 = pts[0].c;
  return pts.map((x) => ({ date: x.date, value: (100 * (x.v / v0)) / (x.c / c0) }));
}

/** Fusionne plusieurs séries en points `{ date, [key]: value }` pour le graphe. */
export function mergeChart(series: { key: string; data: EconomicDataPoint[] }[]): ChartPoint[] {
  const byDate = new Map<string, ChartPoint>();
  for (const s of series) {
    for (const p of s.data) {
      let row = byDate.get(p.date);
      if (!row) {
        row = { date: p.date };
        byDate.set(p.date, row);
      }
      row[s.key] = p.value;
    }
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Série de drawdown roulant (en %, ≤ 0) d'une courbe d'index. */
export function drawdownSeries(index: EconomicDataPoint[]): EconomicDataPoint[] {
  let peak = -Infinity;
  return index.map((p) => {
    if (p.value > peak) peak = p.value;
    return { date: p.date, value: peak > 0 ? (p.value / peak - 1) * 100 : 0 };
  });
}

// ─── Formatage ───────────────────────────────────────────────────────────────

export const fmtPct = (v: number | null | undefined, signed = false): string =>
  v === null || v === undefined ? "—" : `${signed && v > 0 ? "+" : ""}${v.toFixed(1)} %`;

export const fmtRatio = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : v.toFixed(2);

export const fmtMonths = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${v} mois`;

export const fmtMultiple = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${v.toFixed(1)}×`;

export const fmtPts = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)} pts`;

// ─── Browne vs Actions (onglet relatif) ──────────────────────────────────────

/** Verdict qualitatif du compromis Browne vs indice actions local (en réel). */
export type BrowneVerdict =
  | "Supérieur aux actions"
  | "Excellent compromis"
  | "Défensif"
  | "Peu convaincant"
  | "Cas atypique"
  | "Compromis modéré";

/** Écarts RELATIFS Browne − Actions (base de l'onglet) + verdict. */
export interface BrowneVsEquity {
  /** CAGR Browne − CAGR Actions (pts). */
  ecartReturn: number | null;
  /** Volatilité Browne − Volatilité Actions (pts). */
  ecartVol: number | null;
  /** |Max DD Actions| − |Max DD Browne| (pts) : > 0 = Browne protège mieux. */
  drawdownReduction: number | null;
  /** Sharpe Browne − Sharpe Actions. */
  ecartSharpe: number | null;
  verdict: BrowneVerdict | null;
}

/** Ordre d'affichage (du meilleur au moins bon, cas atypique/repli en fin). */
export const VERDICT_ORDER: BrowneVerdict[] = [
  "Supérieur aux actions",
  "Excellent compromis",
  "Défensif",
  "Compromis modéré",
  "Peu convaincant",
  "Cas atypique",
];

/** Hex par verdict (points de la matrice, carte). */
export const VERDICT_HEX: Record<BrowneVerdict, string> = {
  "Supérieur aux actions": "#34d399", // emerald-400
  "Excellent compromis": "#22d3ee", // cyan-400
  Défensif: "#fbbf24", // amber-400
  "Peu convaincant": "#f87171", // red-400
  "Cas atypique": "#a78bfa", // violet-400
  "Compromis modéré": "#94a3b8", // slate-400
};

/** Teinte sobre par verdict (badges tableau). */
export const VERDICT_TONE: Record<BrowneVerdict, string> = {
  "Supérieur aux actions": "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Excellent compromis": "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  Défensif: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Peu convaincant": "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  "Cas atypique": "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "Compromis modéré": "border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

/**
 * Écarts relatifs Browne − Actions (réel) + verdict, à partir d'une ligne de
 * comparaison. Règles verrouillées (Yann) ; « Compromis modéré » = repli pour les
 * cas ne tombant dans aucune règle. `verdict` = null si données insuffisantes.
 */
export function browneVsEquity(row: BrowneComparisonRow): BrowneVsEquity {
  const b = row.real;
  const e = row.equityReal;
  const none: BrowneVsEquity = {
    ecartReturn: null,
    ecartVol: null,
    drawdownReduction: null,
    ecartSharpe: null,
    verdict: null,
  };
  if (!b || !e) return none;

  const ecartReturn =
    b.annualized != null && e.annualized != null ? b.annualized - e.annualized : null;
  const ecartVol = b.volatility != null && e.volatility != null ? b.volatility - e.volatility : null;
  const drawdownReduction =
    b.maxDrawdown != null && e.maxDrawdown != null
      ? Math.abs(e.maxDrawdown) - Math.abs(b.maxDrawdown)
      : null;
  const ecartSharpe = b.sharpe != null && e.sharpe != null ? b.sharpe - e.sharpe : null;

  let verdict: BrowneVerdict | null = null;
  if (ecartReturn != null && drawdownReduction != null && ecartVol != null) {
    if (ecartReturn >= 0 && drawdownReduction >= 5 && ecartVol <= 0) {
      verdict = "Supérieur aux actions";
    } else if (ecartReturn >= -1.5 && drawdownReduction >= 20 && ecartVol <= -3) {
      verdict = "Excellent compromis";
    } else if (ecartReturn < -1.5 && drawdownReduction >= 20) {
      verdict = "Défensif";
    } else if (ecartReturn > 0 && (drawdownReduction < 0 || ecartVol > 0)) {
      verdict = "Cas atypique";
    } else if (ecartReturn < 0 && drawdownReduction < 10) {
      verdict = "Peu convaincant";
    } else {
      verdict = "Compromis modéré";
    }
  }
  return { ecartReturn, ecartVol, drawdownReduction, ecartSharpe, verdict };
}

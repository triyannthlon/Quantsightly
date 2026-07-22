import {
  getQuadrant,
  QUADRANT_TO_REGIME_CODE,
  QUADRANT_REGIME_FR,
  type Quadrant,
  type QuadrantModelResult,
  type TransitionState,
  type Strategy,
  type Velocity,
  type Acceleration,
} from "@/lib/coredata/four-quadrants";
import type { EconomicDataPoint } from "@/lib/coredata/types";
import type { QuadrantModelRow } from "@/lib/coredata/four-quadrants-service";
import { REGIME, type RegimeStyle, type RegimeKey } from "@/app/(admin)/comparaisons/quadrants/regime-palette";
import type { ChartPoint } from "@/app/(admin)/exploration/exploration-chart";

export type PerfMode = "nominal" | "real" | "nominal_vs_inflation";

/** Libellés PUBLICS des stratégies (correspondance des IDs moteur : cf. `four-quadrants/types`). */
export const STRATEGY_LABELS: Record<Strategy, string> = {
  binary: "Allocation par régime",
  dynamic: "Allocation continue",
};

export const TRANSITION_LABELS: Record<TransitionState, string> = {
  none: "Hors transition",
  activity: "Transition activité",
  monetary: "Transition monétaire",
  double: "Double transition",
};

/** Style de régime (palette partagée avec la carte Régimes) pour un quadrant du moteur. */
export function regimeStyleOf(quadrant: Quadrant): RegimeStyle {
  return REGIME[QUADRANT_TO_REGIME_CODE[quadrant]];
}

/**
 * Régime AFFICHÉ à partir d'un snapshot (quadrant + état de transition) :
 * « Zone neutre » dès qu'un axe est dans la bande neutre, sinon le quadrant.
 * Cohérent avec la page Régimes macro et la Vue pays.
 */
export function regimeFromLatest(latest: {
  quadrant: Quadrant;
  transitionState: TransitionState;
}): { label: string; style: RegimeStyle } {
  if (latest.transitionState !== "none") return { label: REGIME.transition.label, style: REGIME.transition };
  const style = regimeStyleOf(latest.quadrant);
  return { label: style.label, style };
}

/** Régime affiché d'un résultat mensuel complet (délègue à `regimeFromLatest`). */
export function displayRegime(r: QuadrantModelResult): { label: string; style: RegimeStyle } {
  return regimeFromLatest(r);
}

/** Clé de régime (palette) d'un snapshot : « transition » si un axe est neutre, sinon le quadrant. */
export function regimeKeyFromLatest(latest: {
  quadrant: Quadrant;
  transitionState: TransitionState;
}): RegimeKey {
  return latest.transitionState !== "none" ? "transition" : QUADRANT_TO_REGIME_CODE[latest.quadrant];
}

// ─── Régions (mirror de la page Régimes / Browne — évite d'importer la carte) ──

export type QuadrantRegion = "monde" | "amerique" | "europe" | "asie";
export type GeoRegion = Exclude<QuadrantRegion, "monde">;

export const REGION_ITEMS = [
  { value: "monde", label: "Monde" },
  { value: "amerique", label: "Amérique" },
  { value: "europe", label: "Europe" },
  { value: "asie", label: "Asie-Pacifique" },
];

/** Assignation région par pays (choix éditorial, aligné sur Browne / la page Régimes). */
export const COUNTRY_REGION: Record<string, GeoRegion> = {
  US: "amerique", CA: "amerique", MX: "amerique", BR: "amerique",
  DE: "europe", FR: "europe", IT: "europe", ES: "europe",
  GB: "europe", CH: "europe", NO: "europe", SE: "europe", DK: "europe",
  JP: "asie", CN: "asie", KR: "asie", IN: "asie", TW: "asie",
  ID: "asie", AU: "asie", HK: "asie", SG: "asie",
};

export const REGION_LABEL: Record<GeoRegion, string> = {
  amerique: "Amérique",
  europe: "Europe",
  asie: "Asie-Pacifique",
};

// ─── 4 Quadrants vs Actions (écarts + profil) — règles verrouillées de Browne ──

export type QuadrantsVerdict =
  | "Supérieur aux actions"
  | "Excellent compromis"
  | "Protecteur"
  | "Protection limitée"
  | "Profil atypique"
  | "Compromis modéré";

/** Écarts RELATIFS 4 Quadrants réel − Actions réelles + profil. */
export interface QuadrantsVsEquity {
  /** CAGR 4Q − CAGR Actions (pts). */
  ecartReturn: number | null;
  /** Volatilité 4Q − Volatilité Actions (pts). */
  ecartVol: number | null;
  /** |Max DD Actions| − |Max DD 4Q| (pts) : > 0 = 4Q protège mieux. */
  drawdownReduction: number | null;
  /** Sharpe 4Q − Sharpe Actions. */
  ecartSharpe: number | null;
  verdict: QuadrantsVerdict | null;
}

/** Ordre d'affichage (meilleur → moins bon, atypique/repli en fin). */
export const VERDICT_ORDER: QuadrantsVerdict[] = [
  "Supérieur aux actions",
  "Excellent compromis",
  "Protecteur",
  "Compromis modéré",
  "Protection limitée",
  "Profil atypique",
];

export const VERDICT_HEX: Record<QuadrantsVerdict, string> = {
  "Supérieur aux actions": "#34d399", // emerald-400
  "Excellent compromis": "#22d3ee", // cyan-400
  Protecteur: "#fbbf24", // amber-400
  "Protection limitée": "#f87171", // red-400
  "Profil atypique": "#a78bfa", // violet-400
  "Compromis modéré": "#94a3b8", // slate-400
};

export const VERDICT_TONE: Record<QuadrantsVerdict, string> = {
  "Supérieur aux actions": "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "Excellent compromis": "border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  Protecteur: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Protection limitée": "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
  "Profil atypique": "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "Compromis modéré": "border-slate-500/30 bg-slate-500/10 text-slate-500 dark:text-slate-400",
};

export const VERDICT_DESC: Record<QuadrantsVerdict, string> = {
  "Supérieur aux actions": "Le 4 Quadrants fait mieux que les actions en rendement tout en réduisant le risque.",
  "Excellent compromis": "Le 4 Quadrants fait presque aussi bien que les actions, avec une baisse maximale nettement plus faible.",
  Protecteur: "Le 4 Quadrants fait moins bien que les actions en rendement, mais réduit fortement les pertes maximales.",
  "Compromis modéré": "Le 4 Quadrants apporte une amélioration partielle, sans remplir les critères des profils les plus favorables.",
  "Protection limitée": "Le 4 Quadrants sous-performe les actions et ne réduit pas suffisamment le drawdown.",
  "Profil atypique": "Le 4 Quadrants présente un comportement inhabituel, par exemple plus de rendement mais aussi plus de risque.",
};

/**
 * Écarts relatifs 4 Quadrants réel − Actions réelles + profil, à partir d'une
 * ligne. Règles verrouillées identiques à Browne ; « Compromis modéré » = repli.
 * `verdict` = null si données insuffisantes.
 */
export function quadrantsVsEquity(row: QuadrantModelRow): QuadrantsVsEquity {
  const b = row.metrics?.real ?? null;
  const e = row.equityReal;
  const none: QuadrantsVsEquity = {
    ecartReturn: null,
    ecartVol: null,
    drawdownReduction: null,
    ecartSharpe: null,
    verdict: null,
  };
  if (!b || !e) return none;

  const ecartReturn = b.annualized != null && e.annualized != null ? b.annualized - e.annualized : null;
  const ecartVol = b.volatility != null && e.volatility != null ? b.volatility - e.volatility : null;
  const drawdownReduction =
    b.maxDrawdown != null && e.maxDrawdown != null ? Math.abs(e.maxDrawdown) - Math.abs(b.maxDrawdown) : null;
  const ecartSharpe = b.sharpe != null && e.sharpe != null ? b.sharpe - e.sharpe : null;

  let verdict: QuadrantsVerdict | null = null;
  if (ecartReturn != null && drawdownReduction != null && ecartVol != null) {
    if (ecartReturn >= 0 && drawdownReduction >= 5 && ecartVol <= 0) verdict = "Supérieur aux actions";
    else if (ecartReturn >= -1.5 && drawdownReduction >= 20 && ecartVol <= -3) verdict = "Excellent compromis";
    else if (ecartReturn < -1.5 && drawdownReduction >= 20) verdict = "Protecteur";
    else if (ecartReturn > 0 && (drawdownReduction < 0 || ecartVol > 0)) verdict = "Profil atypique";
    else if (ecartReturn < 0 && drawdownReduction < 10) verdict = "Protection limitée";
    else verdict = "Compromis modéré";
  }
  return { ecartReturn, ecartVol, drawdownReduction, ecartSharpe, verdict };
}

/** Métadonnées d'affichage des poches (couleurs alignées sur SLEEVE_PALETTE de Browne). */
export const SLEEVE_META = {
  equities: { label: "Actions", hex: "#6C93C7", driver: "l’axe Activité" },
  bonds: { label: "Obligations", hex: "#4FB6A0", driver: "l’axe Inflation" },
  gold: { label: "Or", hex: "#E0A93F", driver: "l’axe Inflation" },
  cash: { label: "Liquidités", hex: "#94A3B8", driver: "l’axe Activité" },
  energy: { label: "Énergie", hex: "#D8734E", driver: "le signal Énergie" },
} as const;

export type SleeveKey = keyof typeof SLEEVE_META;
export const CORE_SLEEVES: SleeveKey[] = ["equities", "bonds", "gold", "cash"];

/**
 * Divergence VISIBLE entre poids détenus et poids cibles (au pourcentage AFFICHÉ) —
 * sert à décider si l'UI v2 doit montrer le bloc secondaire « détenu vs cible ».
 * ⚠️ Indépendant du seuil de la bande : compare uniquement les % arrondis à l'écran,
 * ne révèle donc aucune valeur propriétaire.
 */
export function compositionDiverges(
  held: Record<SleeveKey, number>,
  target: Record<SleeveKey, number>,
): boolean {
  return CORE_SLEEVES.some((k) => Math.round(held[k] * 100) !== Math.round(target[k] * 100));
}

// ─── Restitution d'affichage des allocations (détenu / cible) ──────────────────
// Convention du contrat (cf. model-comparison/types.ts) :
//   targetAllocation is omitted when it is identical to currentAllocation.
//   An unavailable strategy is represented separately through availability/currentAllocation.
// Ces helpers ne font que de la RESTITUTION : ils n'altèrent aucun poids réel du moteur.

/** Poches cœur, dans l'ORDRE d'affichage (mêmes ordre/couleurs pour détenu & cible). */
export const ALLOC_KEYS = ["equities", "bonds", "gold", "cash"] as const;
export type AllocKey = (typeof ALLOC_KEYS)[number];
type CoreAlloc = Partial<Record<AllocKey, number>>;

/**
 * Pourcentages ENTIERS par poche dont la somme vaut exactement 100 (méthode du plus
 * grand reste) — évite les totaux visuels à 99/101 % sans toucher aux poids réels.
 * Les poches à 0 % sont conservées (jamais masquées).
 */
export function roundedAllocPercents(alloc: CoreAlloc): Record<AllocKey, number> {
  const raw = ALLOC_KEYS.map((k) => (alloc[k] ?? 0) * 100);
  const out = raw.map((v) => Math.floor(v));
  const rest = 100 - out.reduce((a, b) => a + b, 0);
  // Les `rest` unités restantes vont aux plus grands restes fractionnaires.
  const byFrac = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let n = 0; n < rest && n < byFrac.length; n++) out[byFrac[n].i] += 1;
  const result = {} as Record<AllocKey, number>;
  ALLOC_KEYS.forEach((k, i) => {
    result[k] = out[i];
  });
  return result;
}

/** Deux jeux de pourcentages entiers identiques poche par poche ? */
export const sameAllocPercents = (
  a: Record<AllocKey, number>,
  b: Record<AllocKey, number>,
): boolean => ALLOC_KEYS.every((k) => a[k] === b[k]);

/**
 * Pourcentages de la CIBLE à afficher, ou `null` si la cible est identique à la
 * détenue (au % affiché) OU absente. Dans les deux cas la vue montre « Identique à
 * l'allocation actuelle » (convention : cible omise = identique, pas indisponible).
 */
export function resolveTargetPercents(
  target: CoreAlloc | undefined,
  heldPcts: Record<AllocKey, number>,
): Record<AllocKey, number> | null {
  if (!target) return null;
  const t = roundedAllocPercents(target);
  return sameAllocPercents(heldPcts, t) ? null : t;
}

/**
 * Stratégies dotées d'une allocation détenue (celles qui obtiennent une carte). Une
 * stratégie indisponible a `currentAllocation = null` → exclue (aucune carte affichée).
 */
export function strategiesWithAllocation<T extends { currentAllocation: CoreAlloc | null }>(
  strategies: T[],
): T[] {
  return strategies.filter((s) => s.currentAllocation != null);
}

// ─── Formatters ──────────────────────────────────────────────────────────────

/** Coordonnée signée [-100,100] arrondie (« +66 », « −12 »). */
export const fmtCoord = (v: number): string => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(Math.round(v));
export const fmtPct0 = (v: number): string => `${Math.round(v * 100)} %`;
export const fmtPct1 = (v: number): string => `${(v * 100).toFixed(1)} %`;
/** Points signés (variation d'un poids en points de %). */
export const fmtPts = (v: number): string => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
/** Valeur en % à 1 décimale, « — » si null. */
export const fmtPctN = (v: number | null): string => (v === null ? "—" : `${v.toFixed(1)} %`);
/** Ratio à 2 décimales, « — » si null. */
export const fmtRatio = (v: number | null): string => (v === null ? "—" : v.toFixed(2));
/** Nombre de mois, « — » si null. */
export const fmtMonths = (v: number | null): string => (v === null ? "—" : `${Math.round(v)} mois`);
/** Multiple « ×N,N », « — » si null. */
export const fmtMultiple = (v: number | null): string =>
  v === null ? "—" : `×${v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

/** Couleurs des trois courbes du module. */
export const SERIES_COLOR = { q4: "#E8833A", browne: "#6C93C7", actions: "#94A3B8" } as const;

/** Fusionne des séries datées en points de graphe (clé par série). */
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

// ─── Dynamique du régime ─────────────────────────────────────────────────────

/**
 * Direction du mouvement décrite en langage produit à partir du vecteur vitesse :
 * le quadrant vers lequel le point se déplace (ou « stable » si la vitesse est
 * négligeable). Ne dépend PAS de la zone de transition (coords brutes).
 */
export function movementDirection(velocity: Velocity | null, minSpeed = 0.5): string {
  if (!velocity || velocity.magnitude < minSpeed) return "Régime stable";
  return `Vers ${QUADRANT_REGIME_FR[getQuadrant(velocity.x, velocity.y)].toLowerCase()}`;
}

/** Lecture de la vitesse radiale : renforcement ou retour au centre. */
export function radialReading(radial: number | null, threshold = 0.5): string {
  if (radial === null) return "Proche du centre";
  if (radial > threshold) return "Le régime se renforce";
  if (radial < -threshold) return "Le régime perd en intensité";
  return "Déplacement latéral";
}

/** Lecture de l'accélération (norme + projection sur le mouvement non exposée en V1). */
export function accelerationReading(magnitude: number | null): string {
  if (magnitude === null) return "—";
  if (magnitude < 0.3) return "Mouvement stable";
  return "Mouvement qui s’intensifie";
}

/** Poche dominante d'une allocation finale. */
export function dominantSleeve(alloc: Record<SleeveKey, number>): SleeveKey {
  return (Object.keys(SLEEVE_META) as SleeveKey[]).reduce((best, k) => (alloc[k] > alloc[best] ? k : best), "equities");
}

/** Les `n` poches cœur les plus pondérées, par ordre décroissant (libellés en minuscules). */
function topSleeveLabels(alloc: Record<SleeveKey, number>, n: number): string[] {
  return [...CORE_SLEEVES]
    .sort((a, b) => alloc[b] - alloc[a])
    .slice(0, n)
    .map((k) => (k === "gold" ? "l’or" : `les ${SLEEVE_META[k].label.toLowerCase()}`));
}

function frenchList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

// ─── Lecture « décision d'abord » (phrases, conviction) ──────────────────────

/** Phrase de description du régime (langage produit, sans jargon). */
export const REGIME_PHRASE: Record<Quadrant, string> = {
  "inflationary-boom": "L’économie accélère tandis que les pressions inflationnistes restent fortes.",
  "disinflationary-boom": "L’économie accélère et les pressions inflationnistes reculent.",
  "inflationary-contraction": "L’activité ralentit alors que l’inflation reste élevée.",
  "disinflationary-contraction": "L’activité et l’inflation ralentissent ensemble.",
};

export type ConvictionLevel = "Très forte" | "Forte" | "Modérée" | "Faible";

/**
 * Conviction = force du PLUS FAIBLE des deux axes (les deux doivent être nets
 * pour un signal fort ; un axe en transition la fait chuter). Score 0-100.
 */
export function conviction(x: number, y: number): { level: ConvictionLevel; score: number } {
  const score = Math.min(Math.abs(x), Math.abs(y));
  const level: ConvictionLevel = score >= 55 ? "Très forte" : score >= 35 ? "Forte" : score >= 20 ? "Modérée" : "Faible";
  return { level, score };
}

/** Teinte de la jauge de conviction par niveau. */
export const CONVICTION_TONE: Record<ConvictionLevel, string> = {
  "Très forte": "bg-emerald-500",
  Forte: "bg-cyan-500",
  Modérée: "bg-amber-500",
  Faible: "bg-slate-400",
};

/** Explication de l'allocation en une phrase, adaptée à l'état de transition. */
export function whyAllocation(r: QuadrantModelResult): string {
  const regime = QUADRANT_REGIME_FR[r.quadrant].toLowerCase();
  const favored = frenchList(topSleeveLabels(r.finalAllocation, 2));
  if (r.transitionState === "double") {
    return "Aucun des deux axes n’envoie de signal net : le modèle revient à une allocation équilibrée entre les quatre poches.";
  }
  const nuance =
    r.transitionState === "activity"
      ? " Le signal d’activité étant proche de sa tendance, actions et liquidités restent équilibrées."
      : r.transitionState === "monetary"
        ? " Le signal monétaire étant proche de sa tendance, or et obligations restent équilibrés."
        : "";
  return `Les signaux pointent vers un régime de ${regime}. Le modèle privilégie ${favored}.${nuance}`;
}

/** Phrase de mouvement (vitesse) : renforcement / retour au centre / stabilité. */
export function movementSentence(velocity: Velocity | null, radial: number | null): string {
  if (!velocity || velocity.magnitude < 0.5) return "Le régime se stabilise.";
  if (radial !== null && radial > 0.5) return "Le régime continue de se renforcer.";
  if (radial !== null && radial < -0.5) return "Le régime se rapproche de la zone neutre.";
  return "Le régime se déplace latéralement.";
}

/** Phrase d'accélération (accélération projetée sur le mouvement), jamais de chiffre. */
export function accelerationSentence(velocity: Velocity | null, acceleration: Acceleration | null): string {
  if (!velocity || !acceleration || velocity.magnitude < 0.5) return "La dynamique est stable.";
  const directional = (velocity.x * acceleration.x + velocity.y * acceleration.y) / velocity.magnitude;
  if (directional > 0.2) return "Le changement de régime s’accélère.";
  if (directional < -0.2) return "Le mouvement ralentit.";
  return "La dynamique est stable.";
}

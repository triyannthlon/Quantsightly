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
import { REGIME, type RegimeStyle } from "@/app/(admin)/comparaisons/quadrants/regime-palette";
import type { ChartPoint } from "@/app/(admin)/exploration/exploration-chart";

export type PerfMode = "nominal" | "real";

/** Libellés des stratégies (badge DQAE géré séparément dans l'UI). */
export const STRATEGY_LABELS: Record<Strategy, string> = {
  binary: "Allocation binaire",
  dynamic: "Allocation dynamique",
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
 * Régime AFFICHÉ, cohérent avec la page Régimes macro : « Régime en transition »
 * dès qu'un axe est dans la bande neutre (|x|≤T ou |y|≤T), sinon le quadrant.
 */
export function displayRegime(r: QuadrantModelResult): { label: string; style: RegimeStyle } {
  if (r.transitionState !== "none") return { label: REGIME.transition.label, style: REGIME.transition };
  const style = regimeStyleOf(r.quadrant);
  return { label: style.label, style };
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

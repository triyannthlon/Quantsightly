import type { EconomicDataPoint } from "@/lib/coredata/types";
import type { ComputeBrowneInput } from "@/lib/coredata/browne";
import type { ChartPoint } from "../../exploration/exploration-chart";

export type BrownePeriod = "MAX" | "20A" | "10A" | "5A";
export type BrowneDisplayMode = "nominal" | "real" | "nominal_vs_inflation";

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

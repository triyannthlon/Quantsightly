// Reconstruction d'un graphique de comparaison depuis sa config (séries +
// opération + devises + MM + plage). Logique alignée sur le canvas Exploration,
// extraite ici pour être réutilisable côté serveur (cartes « Mes comparaisons »).

import type { EconomicSeries, EconomicDataPoint, FxRate, OperationKind } from "@/lib/coredata/types";
import {
  ratioSeries,
  differenceSeries,
  movingAverage,
  scaleSeries,
  commonDateBounds,
  filterByDateRange,
  usdPerUnitMap,
  convertCurrency,
  computeKpis,
  type SeriesKpis,
} from "@/lib/coredata/compute";
import { isConvertibleMeasure } from "@/lib/coredata/authorization";
import type { ChartLine, ChartPoint } from "../exploration/exploration-chart";

const COLOR_PRIMARY = "var(--foreground)";
const COLOR_A = "#E5689E";
const COLOR_B = "#5B9BF5";
const COLOR_MA = "#E8833A";

const EMPTY_KPIS: SeriesKpis = {
  lastMonth: null,
  oneYear: null,
  threeYear: null,
  fiveYear: null,
  annualized: null,
  volatility: null,
};

export interface BuildComparisonInput {
  serieA: EconomicSeries;
  dataA: EconomicDataPoint[];
  serieB?: EconomicSeries;
  dataB?: EconomicDataPoint[];
  operation: OperationKind;
  currencyA?: string;
  currencyB?: string;
  showMA: boolean;
  maYears: number;
  from?: string;
  to?: string;
  fxRates: FxRate[];
}

export interface ComparisonResult {
  chartData: ChartPoint[];
  lines: ChartLine[];
  kpis: SeriesKpis;
  lastValue: number | null;
}

export function buildComparison(input: BuildComparisonInput): ComparisonResult {
  const { serieA, dataA, serieB, dataB, operation, showMA, maYears, from, to, fxRates } = input;

  const usdPerUnit = new Map<string, Map<string, number>>();
  for (const fx of fxRates) usdPerUnit.set(fx.currency, usdPerUnitMap(fx.data, fx.reverse));

  const convert = (
    data: EconomicDataPoint[],
    native: string,
    target: string,
  ): EconomicDataPoint[] => {
    if (!target || target === native) return data;
    const src = native === "USD" ? null : usdPerUnit.get(native) ?? null;
    const tgt = target === "USD" ? null : usdPerUnit.get(target) ?? null;
    if ((native !== "USD" && !src) || (target !== "USD" && !tgt)) return data;
    return convertCurrency(data, src, tgt);
  };

  const convA = convert(dataA, serieA.currency, input.currencyA ?? serieA.currency);
  const convB =
    serieB && dataB ? convert(dataB, serieB.currency, input.currencyB ?? serieB.currency) : null;

  let primary: EconomicDataPoint[] = [];
  let secondary: EconomicDataPoint[] | null = null;
  const lines: ChartLine[] = [];

  if (operation === "single") {
    primary = convA;
    lines.push({ key: "primary", label: serieA.tickerName, color: COLOR_PRIMARY });
  } else if (operation === "overlay" && convB && serieB) {
    primary = convA;
    secondary = convB;
    lines.push({ key: "primary", label: serieA.tickerName, color: COLOR_A });
    lines.push({ key: "secondary", label: serieB.tickerName, color: COLOR_B });
  } else if (operation === "ratio" && convB) {
    primary = ratioSeries(convA, convB);
    lines.push({ key: "primary", label: "Ratio", color: COLOR_PRIMARY });
  } else if (operation === "difference" && convB) {
    primary = differenceSeries(convA, convB);
    lines.push({ key: "primary", label: "Différence", color: COLOR_PRIMARY });
  } else {
    return { chartData: [], lines: [], kpis: EMPTY_KPIS, lastValue: null };
  }

  const ma =
    showMA && maYears > 0 && operation !== "overlay" ? movingAverage(primary, maYears * 12) : null;

  let effFrom = from;
  let effTo = to;
  if (!from && !to && convB && operation !== "single") {
    const bounds = commonDateBounds(convA, convB);
    if (bounds) {
      effFrom = bounds.from;
      effTo = bounds.to;
    }
  }

  const primaryF = filterByDateRange(primary, effFrom, effTo);
  const secondaryF = secondary ? filterByDateRange(secondary, effFrom, effTo) : null;
  const maF = ma ? filterByDateRange(ma, effFrom, effTo) : null;

  const overlayPrices =
    operation === "overlay" &&
    isConvertibleMeasure(serieA.type) &&
    !!serieB &&
    isConvertibleMeasure(serieB.type);

  let dispPrimary = primaryF;
  let dispSecondary = secondaryF;
  let dispMa = maF;
  if (overlayPrices) {
    const fA = primaryF[0]?.value ? 100 / primaryF[0].value : 1;
    dispPrimary = scaleSeries(primaryF, fA);
    dispMa = maF ? scaleSeries(maF, fA) : null;
    if (secondaryF) {
      const fB = secondaryF[0]?.value ? 100 / secondaryF[0].value : 1;
      dispSecondary = scaleSeries(secondaryF, fB);
    }
  }

  if (dispMa && dispMa.length > 0) {
    lines.push({ key: "ma", label: `MM ${maYears} · ${lines[0].label}`, color: COLOR_MA, dashed: true });
  }

  const byDate = new Map<string, ChartPoint>();
  const ensure = (date: string) => {
    let p = byDate.get(date);
    if (!p) {
      p = { date };
      byDate.set(date, p);
    }
    return p;
  };
  for (const p of dispPrimary) ensure(p.date).primary = p.value;
  if (dispSecondary) for (const p of dispSecondary) ensure(p.date).secondary = p.value;
  if (dispMa) for (const p of dispMa) ensure(p.date).ma = p.value;

  const chartData = [...byDate.values()].sort((x, y) => x.date.localeCompare(y.date));
  const lastValue = primaryF.length ? primaryF[primaryF.length - 1].value : null;

  return { chartData, lines, kpis: computeKpis(primaryF), lastValue };
}

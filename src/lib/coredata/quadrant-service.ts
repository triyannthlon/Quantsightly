// Orchestration serveur du modèle 4 quadrants : dérive la config de chaque pays
// depuis le catalogue coredata, charge les séries, les convertit dans la devise
// du pays, puis délègue le calcul à la couche pure `quadrant.ts`.
//
// ⚠️ Module SERVEUR (importe `db.ts` → pool pg). Ne pas importer côté client.

import {
  listSeries,
  getReferenceData,
  getFxRates,
  getSeriesData,
} from "./db";
import type { EconomicSeries, EconomicDataPoint, FxRate, CoredataCountry } from "./types";
import { usdPerUnitMap, convertCurrency } from "./compute";
import {
  computeQuadrant,
  DEFAULT_THRESHOLD,
  DEFAULT_LOOKBACK_MONTHS,
  type QuadrantResult,
} from "./quadrant";

// Séries globales (cotées en USD), communes à tous les pays.
const GLOBAL_OIL_ID = "CL1 comdty-XX-5-1"; // WTI
const GLOBAL_GOLD_ID = "XAU Comdty-XX-5-1"; // Or

export interface CountryQuadrantConfig {
  countryCode: string;
  /** Devise cible = devise du pays. */
  currency: string;
  equityId: string;
  equityCurrency: string;
  bondId: string;
  bondCurrency: string;
  oilId: string;
  oilCurrency: string;
  goldId: string;
  goldCurrency: string;
}

/** Obligation 10 ans = série classe 4 / type 2 du pays dont le ticker contient « 10 ». */
function pickBond10Y(candidates: EconomicSeries[]): EconomicSeries | undefined {
  return candidates.find((s) => /(?<!\d)10(?!\d)/.test(s.tickerName)) ?? candidates[0];
}

/** Dérive la config d'un pays depuis le catalogue (null si une série manque). */
export function deriveCountryConfig(
  countryCode: string,
  series: EconomicSeries[],
  countries: CoredataCountry[],
): CountryQuadrantConfig | null {
  const equity = series.find(
    (s) => s.countryIso === countryCode && s.class === 1 && s.type === 1,
  );
  const bond = pickBond10Y(
    series.filter((s) => s.countryIso === countryCode && s.class === 4 && s.type === 2),
  );
  const oil = series.find((s) => s.id === GLOBAL_OIL_ID);
  const gold = series.find((s) => s.id === GLOBAL_GOLD_ID);
  if (!equity || !bond || !oil || !gold) return null;

  const country = countries.find((c) => c.iso === countryCode);
  const currency = country?.currency || equity.currency;
  return {
    countryCode,
    currency,
    equityId: equity.id,
    equityCurrency: equity.currency,
    bondId: bond.id,
    bondCurrency: bond.currency,
    oilId: oil.id,
    oilCurrency: oil.currency,
    goldId: gold.id,
    goldCurrency: gold.currency,
  };
}

// Contexte partagé (chargé une fois) pour calculer plusieurs pays sans recharger
// le catalogue, les changes et les séries globales oil/or.
interface QuadrantContext {
  series: EconomicSeries[];
  countries: CoredataCountry[];
  usdPerUnit: Map<string, Map<string, number>>;
  oil: EconomicDataPoint[];
  gold: EconomicDataPoint[];
}

function buildConverter(usdPerUnit: Map<string, Map<string, number>>) {
  // Convertit une série de `native` vers `target` via le pivot USD. Si un change
  // manque, la série est laissée telle quelle (devise déjà cohérente attendue).
  return (data: EconomicDataPoint[], native: string, target: string): EconomicDataPoint[] => {
    if (!target || target === native) return data;
    const src = native === "USD" ? null : (usdPerUnit.get(native) ?? null);
    const tgt = target === "USD" ? null : (usdPerUnit.get(target) ?? null);
    if ((native !== "USD" && !src) || (target !== "USD" && !tgt)) return data;
    return convertCurrency(data, src, tgt);
  };
}

async function loadContext(): Promise<QuadrantContext> {
  const [series, ref, fxRates] = await Promise.all([
    listSeries(),
    getReferenceData(),
    getFxRates(),
  ]);
  const usdPerUnit = new Map<string, Map<string, number>>();
  for (const fx of fxRates as FxRate[]) usdPerUnit.set(fx.currency, usdPerUnitMap(fx.data, fx.reverse));
  const [oil, gold] = await Promise.all([
    getSeriesData(GLOBAL_OIL_ID),
    getSeriesData(GLOBAL_GOLD_ID),
  ]);
  return { series, countries: ref.countries, usdPerUnit, oil, gold };
}

async function computeWithContext(
  countryCode: string,
  ctx: QuadrantContext,
): Promise<QuadrantResult> {
  const config = deriveCountryConfig(countryCode, ctx.series, ctx.countries);
  if (!config) {
    return {
      status: "MISSING_SERIES",
      countryCode,
      date: null,
      threshold: DEFAULT_THRESHOLD,
      lookbackMonths: DEFAULT_LOOKBACK_MONTHS,
    };
  }

  const [equityRaw, bondRaw] = await Promise.all([
    getSeriesData(config.equityId),
    getSeriesData(config.bondId),
  ]);

  const convert = buildConverter(ctx.usdPerUnit);
  const target = config.currency;
  return computeQuadrant({
    countryCode,
    equity: convert(equityRaw, config.equityCurrency, target),
    bond: convert(bondRaw, config.bondCurrency, target),
    oil: convert(ctx.oil, config.oilCurrency, target),
    gold: convert(ctx.gold, config.goldCurrency, target),
  });
}

/** Config d'un pays (chargée à la demande). */
export async function getCountryQuadrantConfig(
  countryCode: string,
): Promise<CountryQuadrantConfig | null> {
  const [series, ref] = await Promise.all([listSeries(), getReferenceData()]);
  return deriveCountryConfig(countryCode, series, ref.countries);
}

/** Positionne un pays dans les 4 quadrants à sa dernière date disponible. */
export async function computeCountryQuadrant(countryCode: string): Promise<QuadrantResult> {
  const ctx = await loadContext();
  return computeWithContext(countryCode, ctx);
}

/**
 * Positionne tous les VRAIS pays ayant un indice actions (classe 1 / type 1).
 * `XX` (Monde / indices sectoriels MSCI) est exclu : ce n'est pas un pays et il
 * n'a pas d'obligation souveraine.
 */
export async function computeAllCountryQuadrants(): Promise<QuadrantResult[]> {
  const ctx = await loadContext();
  const countryCodes = [
    ...new Set(
      ctx.series
        .filter((s) => s.class === 1 && s.type === 1 && s.countryIso !== "XX")
        .map((s) => s.countryIso),
    ),
  ].sort();
  return Promise.all(countryCodes.map((iso) => computeWithContext(iso, ctx)));
}

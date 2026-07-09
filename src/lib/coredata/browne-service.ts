// Orchestration serveur du portefeuille de Browne : dérive la config de chaque
// pays depuis le catalogue coredata (poches ty2 + replis), charge les séries,
// convertit l'or en devise locale, délègue le calcul à la couche pure
// `browne.ts`, puis attache les métadonnées (composition, tickers, méthode) et
// la qualité des données.
//
// ⚠️ Module SERVEUR (importe `db.ts` → pool pg). Ne pas importer côté client.

import { listSeries, getReferenceData, getFxRates, getSeriesData } from "./db";
import type { EconomicSeries, EconomicDataPoint, FxRate, CoredataCountry } from "./types";
import { usdPerUnitMap, convertCurrency } from "./compute";
import {
  computeBrowne,
  DEFAULT_REBALANCE,
  type RebalanceFrequency,
  type BrowneResult,
  type ComputeBrowneInput,
} from "./browne";

/** Or global coté en USD, commun à tous les pays. */
const GLOBAL_GOLD_ID = "XAU Comdty-XX-5-1";

/** En deçà de cette profondeur, la fenêtre est jugée « historique court ». */
export const SHORT_HISTORY_MONTHS = 180; // 15 ans

/** Niveau de qualité d'une poche (méthode d'obtention de la série). */
export type SleeveQuality = "Idéal" | "Repli" | "Proxy structurel" | "Converti" | "Observé";

/** Badge de qualité globale d'un pays. */
export type BrowneDataQuality =
  | "Complet"
  | "Complet avec proxy structurel"
  | "Historique court"
  | "Données en repli"
  | "Partiel";

/** Métadonnées d'une poche (carte Composition + carte Qualité des données). */
export interface SleeveConfig {
  /** Libellé de la poche (« Actions », « Obligations 10 ans »…). */
  label: string;
  /** Poids cible (0,25). */
  weight: number;
  seriesId: string;
  tickerName: string;
  /** Libellé DB du type de série (« prix coupons réinvestis »…). */
  typeFr: string | null;
  /** Devise source de la série. */
  currency: string;
  /** Description pédagogique de la méthode. */
  method: string;
  quality: SleeveQuality;
}

export interface CountryBrowneConfig {
  countryCode: string;
  countryFr: string | null;
  /** Devise locale (cible des calculs). */
  currency: string;
  equity: SleeveConfig;
  bond: SleeveConfig;
  cash: SleeveConfig;
  gold: SleeveConfig;
  /** Poche d'inflation (déflateur) — `null` si le CPI manque. */
  inflation: Omit<SleeveConfig, "weight"> | null;
}

export interface CountryBrowneResult {
  config: CountryBrowneConfig | null;
  dataQuality: BrowneDataQuality;
  /**
   * Séries locales prêtes pour `computeBrowne` (recalcul côté client sur
   * changement de rééquilibrage). Rempli pour un pays seul ; `null` en batch.
   */
  input: ComputeBrowneInput | null;
  result: BrowneResult;
}

// ─── Dérivation de la config (sélection des séries + méthode + qualité) ──────

/** Obligation 10 ans = classe 4 / type 2 dont le ticker contient « 10 ». */
function pickBond10Y(candidates: EconomicSeries[]): EconomicSeries | undefined {
  return candidates.find((s) => /(?<!\d)10(?!\d)/.test(s.tickerName)) ?? candidates[0];
}

/** Dérive la config Browne d'un pays depuis le catalogue (null si poche cœur manquante). */
export function deriveBrowneConfig(
  countryCode: string,
  series: EconomicSeries[],
  countries: CoredataCountry[],
): CountryBrowneConfig | null {
  const inCountry = (cls: number, type: number) =>
    series.find((s) => s.countryIso === countryCode && s.class === cls && s.type === type);

  // Actions : total-return (ty2) en priorité, repli sur prix nu (ty1).
  const equityTR = inCountry(1, 2);
  const equityPX = inCountry(1, 1);
  const equity = equityTR ?? equityPX;

  const bond = pickBond10Y(
    series.filter((s) => s.countryIso === countryCode && s.class === 4 && s.type === 2),
  );
  const cash = inCountry(3, 2);
  const gold = series.find((s) => s.id === GLOBAL_GOLD_ID);
  const inflation = inCountry(7, 2);

  if (!equity || !bond || !cash || !gold) return null;

  const country = countries.find((c) => c.iso === countryCode);
  const currency = country?.currency || equity.currency;

  return {
    countryCode,
    countryFr: country?.nameFr ?? equity.countryFr ?? null,
    currency,
    equity: {
      label: "Actions locales",
      weight: 0.25,
      seriesId: equity.id,
      tickerName: equity.tickerName,
      typeFr: equity.typeFr,
      currency: equity.currency,
      method: equityTR
        ? "Indice total-return (dividendes réinvestis)"
        : "Prix simple (dividendes non inclus)",
      quality: equityTR ? "Idéal" : "Repli",
    },
    bond: {
      label: "Obligations 10 ans",
      weight: 0.25,
      seriesId: bond.id,
      tickerName: bond.tickerName,
      typeFr: bond.typeFr,
      currency: bond.currency,
      method: "Proxy total-return reconstruit à partir du taux 10 ans",
      quality: "Proxy structurel",
    },
    cash: {
      label: "Cash",
      weight: 0.25,
      seriesId: cash.id,
      tickerName: cash.tickerName,
      typeFr: cash.typeFr,
      currency: cash.currency,
      method: "Indice capitalisé à partir du taux court",
      quality: "Proxy structurel",
    },
    gold: {
      label: "Or",
      weight: 0.25,
      seriesId: gold.id,
      tickerName: gold.tickerName,
      typeFr: gold.typeFr,
      currency: gold.currency,
      method:
        gold.currency === currency
          ? `Or en ${currency} (série mondiale, sans conversion)`
          : `Or ${gold.currency} converti en ${currency} via le change`,
      quality: "Converti",
    },
    inflation: inflation
      ? {
          label: "Inflation",
          seriesId: inflation.id,
          tickerName: inflation.tickerName,
          typeFr: inflation.typeFr,
          currency: inflation.currency,
          method: "Indice des prix à la consommation (CPI) local",
          quality: "Observé",
        }
      : null,
  };
}

/**
 * Badge global du pays. Le proxy structurel (obligations/cash) est le
 * fonctionnement NORMAL du modèle : il ne dégrade pas le badge. Seuls dégradent :
 * actions en repli, historique court, CPI absent.
 */
function deriveDataQuality(config: CountryBrowneConfig, result: BrowneResult): BrowneDataQuality {
  const flags: BrowneDataQuality[] = [];
  if (config.equity.quality === "Repli") flags.push("Données en repli");
  const months = result.status === "OK" ? result.months : 0;
  if (months > 0 && months < SHORT_HISTORY_MONTHS) flags.push("Historique court");
  if (!config.inflation) flags.push("Partiel"); // pas de courbe réelle

  if (flags.length >= 2) return "Partiel";
  if (flags.length === 1) return flags[0];
  return "Complet";
}

// ─── Contexte partagé + conversion ──────────────────────────────────────────

interface BrowneContext {
  series: EconomicSeries[];
  countries: CoredataCountry[];
  usdPerUnit: Map<string, Map<string, number>>;
  gold: EconomicDataPoint[];
}

function buildConverter(usdPerUnit: Map<string, Map<string, number>>) {
  return (data: EconomicDataPoint[], native: string, target: string): EconomicDataPoint[] => {
    if (!target || target === native) return data;
    const src = native === "USD" ? null : (usdPerUnit.get(native) ?? null);
    const tgt = target === "USD" ? null : (usdPerUnit.get(target) ?? null);
    if ((native !== "USD" && !src) || (target !== "USD" && !tgt)) return data;
    return convertCurrency(data, src, tgt);
  };
}

async function loadContext(): Promise<BrowneContext> {
  const [series, ref, fxRates] = await Promise.all([listSeries(), getReferenceData(), getFxRates()]);
  const usdPerUnit = new Map<string, Map<string, number>>();
  for (const fx of fxRates as FxRate[]) usdPerUnit.set(fx.currency, usdPerUnitMap(fx.data, fx.reverse));
  const gold = await getSeriesData(GLOBAL_GOLD_ID);
  return { series, countries: ref.countries, usdPerUnit, gold };
}

/** Charge et convertit les séries locales d'un pays (prêtes pour `computeBrowne`). */
async function loadInput(
  config: CountryBrowneConfig,
  ctx: BrowneContext,
  rebalance: RebalanceFrequency,
): Promise<ComputeBrowneInput> {
  const [equityRaw, bondRaw, cashRaw, inflationRaw] = await Promise.all([
    getSeriesData(config.equity.seriesId),
    getSeriesData(config.bond.seriesId),
    getSeriesData(config.cash.seriesId),
    config.inflation ? getSeriesData(config.inflation.seriesId) : Promise.resolve([]),
  ]);
  const convert = buildConverter(ctx.usdPerUnit);
  const target = config.currency;
  return {
    countryCode: config.countryCode,
    equity: convert(equityRaw, config.equity.currency, target),
    bond: convert(bondRaw, config.bond.currency, target),
    cash: convert(cashRaw, config.cash.currency, target),
    gold: convert(ctx.gold, config.gold.currency, target),
    inflation: config.inflation ? convert(inflationRaw, config.inflation.currency, target) : undefined,
    rebalance,
  };
}

function missing(countryCode: string, rebalance: RebalanceFrequency): CountryBrowneResult {
  return {
    config: null,
    dataQuality: "Partiel",
    input: null,
    result: { status: "MISSING_SERIES", countryCode, rebalance },
  };
}

// ─── API publique ───────────────────────────────────────────────────────────

/**
 * Portefeuille de Browne d'un pays, avec ses séries locales (`input`) pour un
 * recalcul côté client sur changement de rééquilibrage.
 */
export async function getCountryBrowne(
  countryCode: string,
  rebalance: RebalanceFrequency = DEFAULT_REBALANCE,
): Promise<CountryBrowneResult> {
  const ctx = await loadContext();
  const config = deriveBrowneConfig(countryCode, ctx.series, ctx.countries);
  if (!config) return missing(countryCode, rebalance);

  const input = await loadInput(config, ctx, rebalance);
  const result = computeBrowne(input);
  return { config, dataQuality: deriveDataQuality(config, result), input, result };
}

/**
 * Browne de tous les VRAIS pays (indice actions, hors `XX`), pour la vue
 * Comparaison. `input` est omis (`null`) pour alléger le lot — on n'expose que
 * config + qualité + résultat (métriques + courbes).
 */
export async function computeAllCountryBrowne(
  rebalance: RebalanceFrequency = DEFAULT_REBALANCE,
): Promise<CountryBrowneResult[]> {
  const ctx = await loadContext();
  const codes = [
    ...new Set(ctx.series.filter((s) => s.class === 1 && s.countryIso !== "XX").map((s) => s.countryIso)),
  ].sort();

  return Promise.all(
    codes.map(async (code): Promise<CountryBrowneResult> => {
      const config = deriveBrowneConfig(code, ctx.series, ctx.countries);
      if (!config) return missing(code, rebalance);
      const input = await loadInput(config, ctx, rebalance);
      const result = computeBrowne(input);
      return { config, dataQuality: deriveDataQuality(config, result), input: null, result };
    }),
  );
}

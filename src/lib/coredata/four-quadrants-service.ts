// Orchestration serveur du modèle « 4 Quadrants » : dérive la config de chaque
// pays depuis le catalogue coredata (séries SIGNAL ty1 + PERF ty2 + CPI), charge
// et convertit en devise locale, délègue au moteur pur `four-quadrants/`
// (`buildModel` + `backtestQuadrants`). Renvoie aussi les séries brutes (`signal`
// / `perf`) pour un recalcul CÔTÉ CLIENT au changement de paramètres (T, stratégie).
//
// ⚠️ Module SERVEUR (importe `db.ts` → pool pg). Ne pas importer côté client.

import { listSeries, getReferenceData, getFxRates, getSeriesData } from "./db";
import type { EconomicSeries, EconomicDataPoint, FxRate, CoredataCountry } from "./types";
import { usdPerUnitMap, convertCurrency, computeKpis } from "./compute";
import { rollingPositiveShare, rollingOutperformanceShare } from "./browne";
import {
  buildModel,
  backtestQuadrants,
  weightsFromModel,
  DEFAULT_FOUR_QUADRANTS_SETTINGS,
  type FourQuadrantsModelSettings,
  type BuildModelInput,
  type QuadrantModel,
  type QuadrantModelStatus,
  type QuadrantModelResult,
  type BacktestResult,
  type BacktestStatus,
  type BacktestMetrics,
} from "./four-quadrants";

/** Séries globales cotées en USD, communes à tous les pays. */
const GLOBAL_OIL_ID = "CL1 comdty-XX-5-1"; // WTI
const GLOBAL_GOLD_ID = "XAU Comdty-XX-5-1"; // Or

/** En deçà de cette profondeur de série mensuelle scorée, l'historique est « court ». */
export const SHORT_HISTORY_MONTHS = 120; // 10 ans de coordonnées

/** Horizons glissants de la heatmap de régularité (mois) — mêmes que Browne. */
const HEATMAP_HORIZONS = [12, 36, 60, 120, 240];

export type QuadrantDataQuality = "Complet" | "Historique court" | "Indisponible";

/** Séries de PERFORMANCE (total-return, devise locale) pour le backtest. */
export interface QuadrantPerfInput {
  equityTotalReturn: EconomicDataPoint[];
  bondTotalReturn: EconomicDataPoint[];
  cashTotalReturn: EconomicDataPoint[];
  gold: EconomicDataPoint[];
  cpi?: EconomicDataPoint[];
}

export interface QuadrantModelConfig {
  countryCode: string;
  countryFr: string | null;
  /** Devise locale (cible des calculs). */
  currency: string;
  /** Signal : actions PRIX (ty1). */
  equityPriceId: string;
  equityPriceTicker: string;
  /** Perf : actions total-return (ty2), ou repli sur le prix si le TR manque. */
  equityTotalReturnId: string;
  /** `true` si la perf actions retombe sur le prix nu (pas de ty2). */
  equityTotalReturnFallback: boolean;
  bondId: string;
  cashId: string;
  cpiId: string | null;
}

export interface CountryQuadrantModel {
  config: QuadrantModelConfig | null;
  dataQuality: QuadrantDataQuality;
  /** Séries brutes pour recalcul client-side (`buildModel`) ; `null` en batch. */
  signal: BuildModelInput | null;
  /** Séries de perf pour recalcul client-side (`backtestQuadrants`) ; `null` en batch. */
  perf: QuadrantPerfInput | null;
  model: QuadrantModel;
  backtest: BacktestResult;
}

/** Ligne légère par pays (comparaison) — snapshot + métriques, aucune série. */
export interface QuadrantModelRow {
  countryCode: string;
  countryFr: string | null;
  /** Statut du MODÈLE (régime/coords/allocation) — calculé sur l'historique COMPLET. */
  status: QuadrantModelStatus;
  /** Snapshot courant (régime, coords, allocation) — indépendant de la fenêtre choisie. */
  latest: Pick<
    QuadrantModelResult,
    "date" | "x" | "y" | "quadrant" | "transitionState" | "regimeIntensity" | "finalAllocation"
  > | null;
  /** Statut du BACKTEST sur la FENÊTRE (perf/risque/rotation) — « INSUFFICIENT_HISTORY » ≠ 0. */
  metricsStatus: BacktestStatus;
  /** Métriques fenêtrées (nominal + réel), `null` si la fenêtre est trop courte. */
  metrics: { nominal: BacktestMetrics; real: BacktestMetrics | null } | null;
  /** Inflation locale annualisée sur la fenêtre (mode Nominal vs Inflation). */
  inflationAnnualized: number | null;
  /** Multiple réel cumulé sur la fenêtre (pouvoir d'achat final / initial), `null` sans CPI. */
  realMultiple: number | null;
  /** Rotation annualisée sur la fenêtre (turnover unidirectionnel), `null` si indisponible. */
  turnover: number | null;
  /** Métriques RÉELLES de l'indice actions national (onglet 4Q vs Actions), `null` sans CPI. */
  equityReal: BacktestMetrics | null;
  /** Régularité par horizon (`HEATMAP_HORIZONS`) — part des fenêtres favorables, `null` sans CPI. */
  heatmap: {
    /** % de fenêtres où le 4Q réel a progressé (bat l'inflation). */
    beatsInflation: (number | null)[];
    /** % de fenêtres où le 4Q réel surperforme les actions réelles. */
    beatsEquity: (number | null)[];
  } | null;
  /** Fenêtre effective du backtest (auditabilité), `null` si indisponible. */
  effectivePeriod: { start: string; end: string; months: number } | null;
}

// ─── Dérivation de la config ─────────────────────────────────────────────────

/** Obligation 10 ans = classe 4 / type 2 dont le ticker contient « 10 ». */
function pickBond10Y(candidates: EconomicSeries[]): EconomicSeries | undefined {
  return candidates.find((s) => /(?<!\d)10(?!\d)/.test(s.tickerName)) ?? candidates[0];
}

/** Dérive la config d'un pays (null si une série cœur manque). */
export function deriveQuadrantConfig(
  countryCode: string,
  series: EconomicSeries[],
  countries: CoredataCountry[],
): QuadrantModelConfig | null {
  const inCountry = (cls: number, type: number) =>
    series.find((s) => s.countryIso === countryCode && s.class === cls && s.type === type);

  const equityPrice = inCountry(1, 1); // SIGNAL : prix nu (obligatoire)
  const equityTR = inCountry(1, 2); // PERF : total-return, repli sur le prix
  const bond = pickBond10Y(
    series.filter((s) => s.countryIso === countryCode && s.class === 4 && s.type === 2),
  );
  const cash = inCountry(3, 2);
  const cpi = inCountry(7, 2);
  const hasGlobal =
    series.some((s) => s.id === GLOBAL_OIL_ID) && series.some((s) => s.id === GLOBAL_GOLD_ID);

  if (!equityPrice || !bond || !cash || !hasGlobal) return null;

  const country = countries.find((c) => c.iso === countryCode);
  return {
    countryCode,
    countryFr: country?.nameFr ?? equityPrice.countryFr ?? null,
    currency: country?.currency || equityPrice.currency,
    equityPriceId: equityPrice.id,
    equityPriceTicker: equityPrice.tickerName,
    equityTotalReturnId: (equityTR ?? equityPrice).id,
    equityTotalReturnFallback: !equityTR,
    bondId: bond.id,
    cashId: cash.id,
    cpiId: cpi?.id ?? null,
  };
}

// ─── Contexte partagé + conversion ──────────────────────────────────────────

interface QuadrantContext {
  series: EconomicSeries[];
  countries: CoredataCountry[];
  usdPerUnit: Map<string, Map<string, number>>;
  oil: EconomicDataPoint[];
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

async function loadContext(): Promise<QuadrantContext> {
  const [series, ref, fxRates] = await Promise.all([
    listSeries(),
    getReferenceData(),
    getFxRates(),
  ]);
  const usdPerUnit = new Map<string, Map<string, number>>();
  for (const fx of fxRates as FxRate[])
    usdPerUnit.set(fx.currency, usdPerUnitMap(fx.data, fx.reverse));
  const [oil, gold] = await Promise.all([
    getSeriesData(GLOBAL_OIL_ID),
    getSeriesData(GLOBAL_GOLD_ID),
  ]);
  return { series, countries: ref.countries, usdPerUnit, oil, gold };
}

/** Devise source d'une série depuis le catalogue (repli USD). */
function seriesCurrency(ctx: QuadrantContext, id: string): string {
  return ctx.series.find((s) => s.id === id)?.currency ?? "USD";
}

/** Charge et convertit les séries locales (signal + perf) d'un pays. */
async function loadSeries(
  config: QuadrantModelConfig,
  ctx: QuadrantContext,
): Promise<{ signal: BuildModelInput; perf: QuadrantPerfInput }> {
  const cur = (id: string) => seriesCurrency(ctx, id);
  const [equityPriceRaw, equityTRRaw, bondRaw, cashRaw, cpiRaw] = await Promise.all([
    getSeriesData(config.equityPriceId),
    config.equityTotalReturnId === config.equityPriceId
      ? Promise.resolve<EconomicDataPoint[] | null>(null)
      : getSeriesData(config.equityTotalReturnId),
    getSeriesData(config.bondId),
    getSeriesData(config.cashId),
    config.cpiId ? getSeriesData(config.cpiId) : Promise.resolve<EconomicDataPoint[]>([]),
  ]);

  const convert = buildConverter(ctx.usdPerUnit);
  const t = config.currency;
  const equityPrice = convert(equityPriceRaw, cur(config.equityPriceId), t);
  const equityTR = convert(equityTRRaw ?? equityPriceRaw, cur(config.equityTotalReturnId), t);
  const bond = convert(bondRaw, cur(config.bondId), t);
  const cash = convert(cashRaw, cur(config.cashId), t);
  const gold = convert(ctx.gold, cur(GLOBAL_GOLD_ID), t);
  const oil = convert(ctx.oil, cur(GLOBAL_OIL_ID), t);

  return {
    signal: { countryCode: config.countryCode, equityPrice, oil, gold, bond },
    perf: {
      equityTotalReturn: equityTR,
      bondTotalReturn: bond,
      cashTotalReturn: cash,
      gold,
      cpi: config.cpiId ? convert(cpiRaw, cur(config.cpiId), t) : undefined,
    },
  };
}

function dataQualityOf(model: QuadrantModel): QuadrantDataQuality {
  if (model.status !== "OK") return "Indisponible";
  return model.monthlyResults.length < SHORT_HISTORY_MONTHS ? "Historique court" : "Complet";
}

function runBacktest(
  countryCode: string,
  model: QuadrantModel,
  perf: QuadrantPerfInput,
): BacktestResult {
  if (model.status !== "OK") return { status: "MISSING_SERIES", countryCode };
  return backtestQuadrants({ countryCode, weights: weightsFromModel(model), ...perf });
}

// ─── API publique ───────────────────────────────────────────────────────────

/** Pays éligibles (indice actions PRIX ty1, hors `XX`), triés par nom. */
export async function listQuadrantCountries(): Promise<{ iso: string; nameFr: string }[]> {
  const [series, ref] = await Promise.all([listSeries(), getReferenceData()]);
  const isos = [
    ...new Set(
      series
        .filter((s) => s.class === 1 && s.type === 1 && s.countryIso !== "XX")
        .map((s) => s.countryIso),
    ),
  ];
  const nameByIso = new Map(ref.countries.map((c) => [c.iso, c.nameFr]));
  return isos
    .map((iso) => ({ iso, nameFr: nameByIso.get(iso) ?? iso }))
    .sort((a, b) => a.nameFr.localeCompare(b.nameFr, "fr"));
}

/** Série réelle (base 100) du portefeuille 4 Quadrants d'un pays, pour le comparateur. */
export interface QuadrantsRealSeries {
  countryCode: string;
  countryFr: string | null;
  real: EconomicDataPoint[] | null;
}

/**
 * Séries RÉELLES (base 100) du portefeuille 4 Quadrants des pays demandés, sous
 * les mêmes paramètres (stratégie / zone neutre + fenêtre). Chargées à la demande
 * (2–5 pays) pour le comparateur multi-pays ; l'alignement sur une période commune
 * se fait côté client. Régime toujours sur historique complet ; fenêtre `years`
 * appliquée aux perfs (mêmes règles que le batch).
 */
export async function computeQuadrantsRealSeries(
  codes: string[],
  settings: FourQuadrantsModelSettings = DEFAULT_FOUR_QUADRANTS_SETTINGS,
  years: number | null = null,
): Promise<QuadrantsRealSeries[]> {
  const ctx = await loadContext();
  return Promise.all(
    codes.map(async (code): Promise<QuadrantsRealSeries> => {
      const config = deriveQuadrantConfig(code, ctx.series, ctx.countries);
      if (!config) return { countryCode: code, countryFr: null, real: null };
      const { signal, perf } = await loadSeries(config, ctx);
      const model = buildModel(signal, settings);
      if (model.status !== "OK")
        return { countryCode: code, countryFr: config.countryFr, real: null };
      const backtest = backtestQuadrants({
        countryCode: code,
        weights: weightsFromModel(model),
        ...perf,
        windowYears: years,
      });
      return {
        countryCode: code,
        countryFr: config.countryFr,
        real: backtest.status === "OK" ? backtest.series.real : null,
      };
    }),
  );
}

/** Modèle 4 Quadrants complet d'un pays, avec ses séries brutes (recalcul client-side). */
export async function getCountryQuadrantModel(
  countryCode: string,
  settings: FourQuadrantsModelSettings = DEFAULT_FOUR_QUADRANTS_SETTINGS,
): Promise<CountryQuadrantModel> {
  const ctx = await loadContext();
  const config = deriveQuadrantConfig(countryCode, ctx.series, ctx.countries);
  if (!config) {
    return {
      config: null,
      dataQuality: "Indisponible",
      signal: null,
      perf: null,
      model: { status: "MISSING_SERIES", countryCode, settings },
      backtest: { status: "MISSING_SERIES", countryCode },
    };
  }

  const { signal, perf } = await loadSeries(config, ctx);
  const model = buildModel(signal, settings);
  const backtest = runBacktest(countryCode, model, perf);
  return { config, dataQuality: dataQualityOf(model), signal, perf, model, backtest };
}

/** Ligne « vide » (config absente ou modèle non OK) — régime ET métriques indisponibles. */
function emptyRow(
  code: string,
  countryFr: string | null,
  status: QuadrantModelStatus,
): QuadrantModelRow {
  return {
    countryCode: code,
    countryFr,
    status,
    latest: null,
    metricsStatus: status === "OK" ? "INSUFFICIENT_HISTORY" : "MISSING_SERIES",
    metrics: null,
    inflationAnnualized: null,
    realMultiple: null,
    turnover: null,
    equityReal: null,
    heatmap: null,
    effectivePeriod: null,
  };
}

/**
 * Modèle de tous les vrais pays — snapshot + métriques uniquement (aucune série).
 *
 * ⚠️ Le régime, les coordonnées et l'allocation (`latest`) sont TOUJOURS calculés
 * sur l'historique COMPLET (signal) → ils ne changent PAS avec `years`. La fenêtre
 * `years` ne s'applique qu'aux perfs / risques / drawdowns / rotation (backtest).
 * Si la fenêtre est trop courte, `metrics`/`turnover` sont `null` avec
 * `metricsStatus = "INSUFFICIENT_HISTORY"` (jamais `0`).
 */
export async function computeAllCountryQuadrantModels(
  settings: FourQuadrantsModelSettings = DEFAULT_FOUR_QUADRANTS_SETTINGS,
  years: number | null = null,
): Promise<QuadrantModelRow[]> {
  const ctx = await loadContext();
  const codes = [
    ...new Set(
      ctx.series
        .filter((s) => s.class === 1 && s.type === 1 && s.countryIso !== "XX")
        .map((s) => s.countryIso),
    ),
  ].sort();

  return Promise.all(
    codes.map(async (code): Promise<QuadrantModelRow> => {
      const config = deriveQuadrantConfig(code, ctx.series, ctx.countries);
      if (!config) return emptyRow(code, null, "MISSING_SERIES");

      const { signal, perf } = await loadSeries(config, ctx);
      const model = buildModel(signal, settings); // historique COMPLET → régime/coords/alloc
      if (model.status !== "OK") return emptyRow(code, config.countryFr, model.status);

      const r = model.latest;
      const latest = {
        date: r.date,
        x: r.x,
        y: r.y,
        quadrant: r.quadrant,
        transitionState: r.transitionState,
        regimeIntensity: r.regimeIntensity,
        finalAllocation: r.finalAllocation,
      };

      // Backtest sur l'historique COMPLET puis fenêtré (poids détenus corrects à
      // l'entrée) : perf entière + `windowYears`, poids issus du modèle complet.
      const backtest = backtestQuadrants({
        countryCode: code,
        weights: weightsFromModel(model),
        ...perf,
        windowYears: years,
      });
      if (backtest.status !== "OK") {
        return {
          countryCode: code,
          countryFr: config.countryFr,
          status: "OK",
          latest,
          metricsStatus: backtest.status,
          metrics: null,
          inflationAnnualized: null,
          realMultiple: null,
          turnover: null,
          equityReal: null,
          heatmap: null,
          effectivePeriod: null,
        };
      }

      const realSeries = backtest.series.real;
      const equityRealSeries = backtest.series.equityReal;
      const realMultiple =
        realSeries && realSeries.length >= 2 && realSeries[0].value > 0
          ? realSeries[realSeries.length - 1].value / realSeries[0].value
          : null;
      const heatmap = realSeries
        ? {
            beatsInflation: HEATMAP_HORIZONS.map((w) => rollingPositiveShare(realSeries, w)),
            beatsEquity: equityRealSeries
              ? HEATMAP_HORIZONS.map((w) =>
                  rollingOutperformanceShare(realSeries, equityRealSeries, w),
                )
              : HEATMAP_HORIZONS.map(() => null),
          }
        : null;

      return {
        countryCode: code,
        countryFr: config.countryFr,
        status: "OK",
        latest,
        metricsStatus: "OK",
        metrics: { nominal: backtest.metrics.nominal, real: backtest.metrics.real },
        inflationAnnualized: computeKpis(backtest.series.inflationIndex ?? []).annualized,
        realMultiple,
        turnover: backtest.turnover.annualized,
        equityReal: backtest.metrics.equityReal,
        heatmap,
        effectivePeriod: {
          start: backtest.start,
          end: backtest.end,
          months: backtest.metrics.nominal.months,
        },
      };
    }),
  );
}

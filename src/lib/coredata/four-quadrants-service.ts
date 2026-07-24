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
  availabilityOf,
  computeEnergyTrendSignal,
  energyTrendScores,
  DEFAULT_FOUR_QUADRANTS_SETTINGS,
  type FourQuadrantsModelSettings,
  type BuildModelInput,
  type QuadrantModel,
  type QuadrantModelStatus,
  type QuadrantModelResult,
  type BacktestResult,
  type BacktestStatus,
  type BacktestMetrics,
  type Availability,
  REALLOCATION_BAND,
  DEFAULT_MODEL_VERSION,
  type ModelVersion,
} from "./four-quadrants";
// Energy overlay selection must be explicit at every product call site.
// Environment flags may gate the laboratory UI but must never alter
// public model calculations implicitly.
// ⇒ Le service NE lit PLUS `QS_ENERGY_OVERLAY` : `overlay` défaute à "off" (socle public
//   `4q-standard-v2`) ; les chemins produit passent "off" explicitement, le laboratoire Énergie
//   passe "off"/"trend-v1" explicitement. `readEnergyOverlay` reste réservé aux scripts/concordance.
import type { EnergyOverlayVersion } from "./energy-overlay-config";
import {
  buildEnergyLabComparison,
  type EnergyLabComparison,
  type EnergyLabStrategy,
} from "./four-quadrants/energy-trend-v1/lab";
import {
  computeModelComparison,
  withCurrentMonthExcluded,
  type ModelComparisonResult,
  type ComparisonMode,
} from "./model-comparison";

/** Séries globales cotées en USD, communes à tous les pays. */
const GLOBAL_OIL_ID = "CL1 comdty-XX-5-1"; // WTI
const GLOBAL_GOLD_ID = "XAU Comdty-XX-5-1"; // Or
const GLOBAL_ENERGY_ID = "SPDYENT Index-XX-5-2"; // S&P GSCI Energy Dynamic Roll TR (surcouche `trend-v1`)

/** En deçà de cette profondeur de série mensuelle scorée, l'historique est « court ». */
export const SHORT_HISTORY_MONTHS = 120; // 10 ans de coordonnées

/** Horizons glissants de la heatmap de régularité (mois) — mêmes que Browne. */
const HEATMAP_HORIZONS = [12, 36, 60, 120, 240];

export type QuadrantDataQuality = "Complet" | "Historique court" | "Données en repli" | "Partiel";

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
  /** Disponibilité structurée des métriques fenêtrées (statut + raison + 1er mois fautif). */
  availability: Availability;
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
  /** Surcouche Énergie active (lue au build). `off` = socle v2. */
  overlay: EnergyOverlayVersion;
  /** SPDYENT (niveau USD) — chargé UNIQUEMENT si `overlay === "trend-v1"`, sinon `null`. */
  energyUsd: EconomicDataPoint[] | null;
  /** Scores de tendance injectables (100 actif / 0 inactif dispo) — `null` hors `trend-v1`. */
  energyScores: EconomicDataPoint[] | null;
}

/** Réglages effectifs : mode `trend` sous la surcouche, inchangés sinon (socle v2). */
function overlaySettings(
  settings: FourQuadrantsModelSettings,
  ctx: QuadrantContext,
): FourQuadrantsModelSettings {
  return ctx.overlay === "trend-v1" ? { ...settings, energyMode: "trend" } : settings;
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

async function loadContext(overlay: EnergyOverlayVersion): Promise<QuadrantContext> {
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
  // Surcouche `trend-v1` : charger SPDYENT (USD) + calculer le signal SMA6 (une fois, global).
  let energyUsd: EconomicDataPoint[] | null = null;
  let energyScores: EconomicDataPoint[] | null = null;
  if (overlay === "trend-v1") {
    energyUsd = await getSeriesData(GLOBAL_ENERGY_ID);
    energyScores = energyTrendScores(computeEnergyTrendSignal(energyUsd));
  }
  return {
    series,
    countries: ref.countries,
    usdPerUnit,
    oil,
    gold,
    overlay,
    energyUsd,
    energyScores,
  };
}

/** Devise source d'une série depuis le catalogue (repli USD). */
function seriesCurrency(ctx: QuadrantContext, id: string): string {
  return ctx.series.find((s) => s.id === id)?.currency ?? "USD";
}

/** Charge et convertit les séries locales (signal + perf) d'un pays. */
async function loadSeries(
  config: QuadrantModelConfig,
  ctx: QuadrantContext,
): Promise<{
  signal: BuildModelInput;
  perf: QuadrantPerfInput;
  energyLocal: EconomicDataPoint[] | null;
}> {
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
  // Surcouche `trend-v1` : SPDYENT converti en devise locale (MÊME méthode que l'or), pour la
  // perf de la poche Énergie ; signal de tendance (global USD) injecté via `energyScore`.
  const energyLocal =
    ctx.overlay === "trend-v1" && ctx.energyUsd
      ? convert(ctx.energyUsd, cur(GLOBAL_ENERGY_ID), t)
      : null;

  return {
    signal: {
      countryCode: config.countryCode,
      equityPrice,
      oil,
      gold,
      bond,
      energyScore: ctx.energyScores ?? undefined,
    },
    perf: {
      equityTotalReturn: equityTR,
      bondTotalReturn: bond,
      cashTotalReturn: cash,
      gold,
      cpi: config.cpiId ? convert(cpiRaw, cur(config.cpiId), t) : undefined,
    },
    energyLocal,
  };
}

// Badge global de disponibilité — MÊME logique que `deriveDataQuality` de Browne :
// on combine les défauts par série (repli actions, CPI absent, historique court).
function dataQualityOf(config: QuadrantModelConfig, model: QuadrantModel): QuadrantDataQuality {
  if (model.status !== "OK") return "Partiel";
  const flags: QuadrantDataQuality[] = [];
  if (config.equityTotalReturnFallback) flags.push("Données en repli"); // actions en prix nu
  const months = model.monthlyResults.length;
  if (months > 0 && months < SHORT_HISTORY_MONTHS) flags.push("Historique court");
  if (!config.cpiId) flags.push("Partiel"); // pas de courbe réelle (inflation absente)
  if (flags.length >= 2) return "Partiel";
  if (flags.length === 1) return flags[0];
  return "Complet";
}

function runBacktest(
  countryCode: string,
  model: QuadrantModel,
  perf: QuadrantPerfInput,
  version: ModelVersion = DEFAULT_MODEL_VERSION,
  energyLocal: EconomicDataPoint[] | null = null,
): BacktestResult {
  if (model.status !== "OK")
    return {
      status: "MISSING_SERIES",
      countryCode,
      availability: availabilityOf("MISSING_SERIES"),
    };
  return backtestQuadrants({
    countryCode,
    weights: weightsFromModel(model),
    ...perf,
    // `trend-v1` : perf de la 5ᵉ poche ; `off` : `undefined` (backtest v2 strict, fenêtre inchangée).
    energyTotalReturn: energyLocal ?? undefined,
    reallocationBand: REALLOCATION_BAND[version],
  });
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
  version: ModelVersion = DEFAULT_MODEL_VERSION,
  overlay: EnergyOverlayVersion = "off",
): Promise<QuadrantsRealSeries[]> {
  const ctx = await loadContext(overlay);
  return Promise.all(
    codes.map(async (code): Promise<QuadrantsRealSeries> => {
      const config = deriveQuadrantConfig(code, ctx.series, ctx.countries);
      if (!config) return { countryCode: code, countryFr: null, real: null };
      const { signal, perf, energyLocal } = await loadSeries(config, ctx);
      const model = buildModel(signal, overlaySettings(settings, ctx));
      if (model.status !== "OK")
        return { countryCode: code, countryFr: config.countryFr, real: null };
      const backtest = backtestQuadrants({
        countryCode: code,
        weights: weightsFromModel(model),
        ...perf,
        energyTotalReturn: energyLocal ?? undefined,
        windowYears: years,
        reallocationBand: REALLOCATION_BAND[version],
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
  version: ModelVersion = DEFAULT_MODEL_VERSION,
  overlay: EnergyOverlayVersion = "off",
): Promise<CountryQuadrantModel> {
  const ctx = await loadContext(overlay);
  const config = deriveQuadrantConfig(countryCode, ctx.series, ctx.countries);
  if (!config) {
    return {
      config: null,
      dataQuality: "Partiel",
      signal: null,
      perf: null,
      model: { status: "MISSING_SERIES", countryCode, settings },
      backtest: {
        status: "MISSING_SERIES",
        countryCode,
        availability: availabilityOf("MISSING_SERIES"),
      },
    };
  }

  const { signal, perf, energyLocal } = await loadSeries(config, ctx);
  const model = buildModel(signal, overlaySettings(settings, ctx));
  const backtest = runBacktest(countryCode, model, perf, version, energyLocal);
  return { config, dataQuality: dataQualityOf(config, model), signal, perf, model, backtest };
}

/** Ligne « vide » (config absente ou modèle non OK) — régime ET métriques indisponibles. */
function emptyRow(
  code: string,
  countryFr: string | null,
  status: QuadrantModelStatus,
): QuadrantModelRow {
  const metricsStatus: BacktestStatus = status === "OK" ? "INSUFFICIENT_HISTORY" : "MISSING_SERIES";
  return {
    countryCode: code,
    countryFr,
    status,
    latest: null,
    metricsStatus,
    metrics: null,
    inflationAnnualized: null,
    realMultiple: null,
    turnover: null,
    equityReal: null,
    heatmap: null,
    effectivePeriod: null,
    availability: availabilityOf(metricsStatus),
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
  version: ModelVersion = DEFAULT_MODEL_VERSION,
  overlay: EnergyOverlayVersion = "off",
): Promise<QuadrantModelRow[]> {
  const ctx = await loadContext(overlay);
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

      const { signal, perf, energyLocal } = await loadSeries(config, ctx);
      const model = buildModel(signal, overlaySettings(settings, ctx)); // historique COMPLET → régime/coords/alloc
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
        energyTotalReturn: energyLocal ?? undefined,
        windowYears: years,
        reallocationBand: REALLOCATION_BAND[version],
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
          availability: backtest.availability,
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
        availability: backtest.availability,
      };
    }),
  );
}

// ─── Comparaison « 4 Quadrants vs Browne » (onglet interne) ──────────────────

export interface BrowneComparisonOptions {
  /** Fenêtre en années (`null` = Max). */
  period: number | null;
  mode: ComparisonMode;
  /** Coûts (bps sur la rotation exécutée). */
  costBps: number;
  /** Demi-largeur de la zone de transition (réglage global). */
  transitionWidth: number;
}

/**
 * Comparaison Browne / 4Q Dynamique / 4Q Binaire d'UN pays, calculée CÔTÉ SERVEUR
 * (le moteur pur `model-comparison` + `browne` restent hors du bundle client). Charge
 * les mêmes séries que la Vue pays, applique la garde « mois courant exclu » (horloge
 * serveur), puis renvoie la version NETTE (coûts) et la version BRUTE (0 bps) pour
 * l'écart brut/net. `null` si le pays n'a pas de configuration exploitable.
 */
export async function computeModelComparisonForCountry(
  countryCode: string,
  opts: BrowneComparisonOptions,
  version: ModelVersion = DEFAULT_MODEL_VERSION,
  overlay: EnergyOverlayVersion = "off",
): Promise<{ net: ModelComparisonResult; gross: ModelComparisonResult } | null> {
  const ctx = await loadContext(overlay);
  const config = deriveQuadrantConfig(countryCode, ctx.series, ctx.countries);
  if (!config) return null;

  const { signal, perf } = await loadSeries(config, ctx);
  const guarded = withCurrentMonthExcluded(
    {
      countryCode,
      signal,
      perf,
      transitionWidth: opts.transitionWidth,
      reallocationBand: REALLOCATION_BAND[version],
    },
    new Date().toISOString().slice(0, 7),
  );
  const base = { period: opts.period, mode: opts.mode, costBps: opts.costBps };
  return {
    net: computeModelComparison(guarded, base),
    gross: computeModelComparison(guarded, { ...base, costBps: 0 }),
  };
}

/**
 * LABORATOIRE ÉNERGIE (interne, gated `QS_ENERGY_LAB_ENABLED`) — comparaison socle 4Q vs socle
 * 4Q + Énergie pour UNE stratégie (Continue/Régime). Calcule EXPLICITEMENT les deux variantes :
 * standard (`overlay:"off"` = `4q-standard-v2`) et énergie (`overlay:"trend-v1"` = candidat figé
 * `energy-trend-v1`). Overlay OBLIGATOIRE au bord produit (aucune lecture d'env). Ne touche RIEN
 * de public. `null` si le pays n'a pas de modèle exploitable dans les deux variantes.
 */
export async function computeEnergyLabComparison(
  countryCode: string,
  strategy: EnergyLabStrategy,
  version: ModelVersion = DEFAULT_MODEL_VERSION,
): Promise<EnergyLabComparison | null> {
  const settings: FourQuadrantsModelSettings = { ...DEFAULT_FOUR_QUADRANTS_SETTINGS, strategy };
  const [standard, energy] = await Promise.all([
    getCountryQuadrantModel(countryCode, settings, version, "off"),
    getCountryQuadrantModel(countryCode, settings, version, "trend-v1"),
  ]);
  return buildEnergyLabComparison({
    strategy,
    countryCode,
    countryFr: standard.config?.countryFr ?? null,
    currency: standard.config?.currency ?? "",
    standardBacktest: standard.backtest,
    energyBacktest: energy.backtest,
    energyModel: energy.model,
  });
}

// ─── Laboratoire Énergie — contrats + assembleur PUR (aucune DB) ──────────────
//
// Compare, pour UNE stratégie 4Q (Continue/Régime), le socle « standard » (overlay off,
// `energyMode:"disabled"`) à sa variante « + Énergie » (overlay trend-v1, `energyMode:"trend"`).
// RÉUTILISE les sorties moteur (`BacktestResult`, `QuadrantModel`) sans AUCUN recalcul : le
// service serveur fournit les deux modèles via `getCountryQuadrantModel(..., "off"|"trend-v1")`.
//
// ⚠️ INTERNE / staging UNIQUEMENT (gate `QS_ENERGY_LAB_ENABLED`). Ne touche RIEN de public :
// aucune formule / poids / golden / modèle standard modifié. La 5ᵉ poche `energy` n'existe QUE
// dans cette structure de labo.

import type { BacktestMetrics, BacktestResult, FinalAllocation, QuadrantModel } from "../index";

/** Stratégie 4Q comparée (identifiants moteur conservés). */
export type EnergyLabStrategy = "dynamic" | "binary";
export type EnergyVariantId = "standard" | "energy";
export type SignalMonthState = "active" | "inactive" | "unavailable";

type OkBacktest = Extract<BacktestResult, { status: "OK" }>;

/** Libellés PUBLICS (méthodologie ≠ paramètres propriétaires). */
const STRATEGY_LABEL: Record<EnergyLabStrategy, string> = {
  dynamic: "4Q Continue",
  binary: "4Q Régime",
};

/** Une colonne de comparaison : le backtest complet (séries/métriques/contributions/rotation). */
export interface EnergyLabVariant {
  id: EnergyVariantId;
  label: string;
  overlay: "off" | "trend-v1";
  backtest: OkBacktest;
}

/** État du signal de tendance Énergie (section « Signal ») — sans divulguer la règle propriétaire. */
export interface EnergySignalState {
  /** Dernière date mensuelle analysée. */
  lastMonth: string | null;
  status: SignalMonthState;
  /** Poche Énergie réellement détenue au dernier mois (variante Énergie). */
  heldWeight: number;
  /** Poche Énergie cible au dernier mois. */
  targetWeight: number;
  /** Détenu ≠ cible (la bande a retenu une réallocation). */
  reallocationRequired: boolean;
  /** Frise mensuelle actif/inactif/indisponible (jamais interpolée). */
  history: { date: string; state: SignalMonthState }[];
}

/** Sortie du service labo : socle vs socle + Énergie, pour la stratégie choisie. */
export interface EnergyLabComparison {
  strategy: EnergyLabStrategy;
  countryCode: string;
  countryFr: string | null;
  currency: string;
  standard: EnergyLabVariant;
  energy: EnergyLabVariant;
  signal: EnergySignalState;
}

const scoreState = (s: number | null): SignalMonthState =>
  s === null ? "unavailable" : s > 0 ? "active" : "inactive";

/**
 * Monte la comparaison à partir des DEUX modèles moteur déjà calculés (standard + énergie).
 * PUR : aucune DB, aucun recalcul. `null` si un backtest ou le modèle énergie n'est pas OK.
 */
export function buildEnergyLabComparison(input: {
  strategy: EnergyLabStrategy;
  countryCode: string;
  countryFr: string | null;
  currency: string;
  standardBacktest: BacktestResult;
  energyBacktest: BacktestResult;
  /** Modèle de la variante ÉNERGIE (porte le signal injecté + l'allocation 5 poches). */
  energyModel: QuadrantModel;
}): EnergyLabComparison | null {
  const { standardBacktest, energyBacktest, energyModel } = input;
  if (standardBacktest.status !== "OK" || energyBacktest.status !== "OK") return null;
  if (energyModel.status !== "OK") return null;

  const base = STRATEGY_LABEL[input.strategy];
  const history = energyModel.monthlyResults.map((r) => ({
    date: r.date,
    state: scoreState(r.energyScore),
  }));
  const latest = energyModel.latest;
  const heldWeight = energyBacktest.heldAllocation.energy;
  const targetWeight = energyBacktest.targetAllocation.energy;

  return {
    strategy: input.strategy,
    countryCode: input.countryCode,
    countryFr: input.countryFr,
    currency: input.currency,
    standard: { id: "standard", label: base, overlay: "off", backtest: standardBacktest },
    energy: {
      id: "energy",
      label: `${base} + Énergie`,
      overlay: "trend-v1",
      backtest: energyBacktest,
    },
    signal: {
      lastMonth: latest?.date ?? null,
      status: scoreState(latest?.energyScore ?? null),
      heldWeight,
      targetWeight,
      reallocationRequired: Math.abs(heldWeight - targetWeight) > 1e-9,
      history,
    },
  };
}

// ─── Signature compacte (fixtures de production / concordance) ─────────────────
// Extrait des sorties moteur un jeu de nombres STABLES suffisant pour détecter toute
// dérive. Les golden `experiments/4q-energy-trend-rc1/` restent la preuve de recherche ;
// ces signatures sont la NON-RÉGRESSION du moteur réellement branché.

const pick = (m: BacktestMetrics) => ({
  months: m.months,
  annualized: m.annualized,
  volatility: m.volatility,
  sharpe: m.sharpe,
  maxDrawdown: m.maxDrawdown,
  maxUnderwaterMonths: m.maxUnderwaterMonths,
});
const round = (n: number) => Math.round(n * 1e10) / 1e10;
const allocSig = (a: FinalAllocation) => ({
  equities: round(a.equities),
  bonds: round(a.bonds),
  gold: round(a.gold),
  cash: round(a.cash),
  energy: round(a.energy),
});
const variantSig = (v: EnergyLabVariant) => ({
  label: v.label,
  overlay: v.overlay,
  metricsNominal: pick(v.backtest.metrics.nominal),
  contributions: v.backtest.contributions,
  turnoverAnnualized: round(v.backtest.turnover.annualized),
  held: allocSig(v.backtest.heldAllocation),
  target: allocSig(v.backtest.targetAllocation),
});

export interface EnergyLabSignature {
  strategy: EnergyLabStrategy;
  countryCode: string;
  standard: ReturnType<typeof variantSig>;
  energy: ReturnType<typeof variantSig>;
  signal: {
    lastMonth: string | null;
    status: SignalMonthState;
    heldWeight: number;
    targetWeight: number;
    reallocationRequired: boolean;
    activeMonths: number;
    unavailableMonths: number;
  };
}

/** Projection compacte et déterministe d'une comparaison — sert de golden de production. */
export function energyLabSignature(c: EnergyLabComparison): EnergyLabSignature {
  return {
    strategy: c.strategy,
    countryCode: c.countryCode,
    standard: variantSig(c.standard),
    energy: variantSig(c.energy),
    signal: {
      lastMonth: c.signal.lastMonth,
      status: c.signal.status,
      heldWeight: round(c.signal.heldWeight),
      targetWeight: round(c.signal.targetWeight),
      reallocationRequired: c.signal.reallocationRequired,
      activeMonths: c.signal.history.filter((h) => h.state === "active").length,
      unavailableMonths: c.signal.history.filter((h) => h.state === "unavailable").length,
    },
  };
}

// Génération des titres de la page Exploration.
//
// Deux titres distincts :
//   - Titre du graphique : décrit *ce qu'on regarde* (séries / comparaison).
//   - Titre du panneau de stats : décrit *la nature des chiffres* affichés.

import type { EconomicSeries, ClassRef, TypeRef, OperationKind } from "@/lib/coredata/types";

/** Libellé lisible d'une mesure (évite les noms techniques bruts dans les titres). */
export const READABLE_MEASURE: Record<TypeRef, string> = {
  1: "prix",
  2: "rendement total",
  3: "taux",
  4: "taux réel",
  5: "PER",
  6: "volume",
  7: "spot",
};

/** Forme plurielle des classes (pour comparer deux pays de même classe). */
const CLASS_PLURAL: Record<ClassRef, string> = {
  1: "indices boursiers",
  2: "taux de change",
  3: "liquidités",
  4: "obligations à 10 ans",
  5: "matières premières",
  6: "cryptomonnaies",
  7: "inflation",
  8: "croissance réelle",
  9: "commerce international",
  10: "bases monétaires",
};

/** Titre du panneau de stats selon l'opération et la mesure. */
export const STATS_TITLE: Record<OperationKind, Record<TypeRef, string>> = {
  single: {
    1: "Performance du prix",
    2: "Rendement total",
    3: "Évolution du taux",
    4: "Évolution du taux réel",
    5: "Valorisation",
    6: "Évolution du volume",
    7: "Taux de change spot",
  },
  overlay: {
    1: "Performances comparées",
    2: "Rendements totaux comparés",
    3: "Taux comparés",
    4: "Taux réels comparés",
    5: "Valorisations comparées",
    6: "Volumes comparés",
    7: "Taux de change comparés",
  },
  ratio: {
    1: "Performance relative",
    2: "Rendement relatif",
    3: "Ratio de taux",
    4: "Ratio de taux réel",
    5: "Ratio de valorisation",
    6: "Ratio de volumes",
    7: "Ratio de change",
  },
  difference: {
    1: "Écart de prix",
    2: "Écart de rendement total",
    3: "Spread de taux",
    4: "Spread de taux réel",
    5: "Écart de valorisation",
    6: "Écart de volumes",
    7: "Écart de change",
  },
};

export interface TitledSeries {
  serie: EconomicSeries;
  currency: string;
}

function cap(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

function pays(s: EconomicSeries): string {
  return s.countryFr ?? s.countryIso;
}

// « en {devise} » si une devise est présente et que la mesure n'est pas le spot.
function curSuffix(serie: EconomicSeries, currency: string): string {
  if (!currency || serie.type === 7) return "";
  return ` en ${currency}`;
}

/** Deux sélections désignent-elles le même actif affiché dans la même devise ? */
export function sameSeries(a: TitledSeries, b: TitledSeries): boolean {
  return a.serie.id === b.serie.id && a.currency === b.currency;
}

/** Titre du graphique selon l'opération. */
export function buildGraphTitle(
  operation: OperationKind,
  a: TitledSeries,
  b: TitledSeries | null,
): string {
  const A = a.serie;
  const measure = READABLE_MEASURE[A.type];

  // Une seule série (ou B strictement identique à A).
  if (operation === "single" || !b || sameSeries(a, b)) {
    return cap(`${A.classFr} ${pays(A)} — ${measure}${curSuffix(A, a.currency)}`);
  }

  const B = b.serie;

  if (operation === "overlay") {
    if (A.class === B.class && A.type === B.type) {
      const plural = CLASS_PLURAL[A.class];
      if (a.currency && a.currency === b.currency) {
        return cap(`${plural} — ${pays(A)} vs ${pays(B)}, ${measure}${curSuffix(A, a.currency)}`);
      }
      const aPart = `${pays(A)}${curSuffix(A, a.currency)}`;
      const bPart = `${pays(B)}${curSuffix(B, b.currency)}`;
      return cap(`${plural} — ${aPart} vs ${bPart}, ${measure}`);
    }
    return cap(`${A.classFr} ${pays(A)} vs ${B.classFr} ${pays(B)}`);
  }

  if (operation === "ratio") {
    const cur = a.currency && a.currency === b.currency ? curSuffix(A, a.currency) : "";
    if (A.class === B.class) {
      return cap(`Ratio ${pays(A)} / ${pays(B)} — ${A.classFr}, ${measure}${cur}`);
    }
    return cap(`Ratio ${A.classFr} ${pays(A)} / ${B.classFr} ${pays(B)} — ${measure}${cur}`);
  }

  // Différence : « Spread de … » pour les taux, « Écart de … » sinon.
  const verb = A.type === 3 || A.type === 4 ? "Spread de" : "Écart de";
  return `${verb} ${measure} ${pays(A)} - ${pays(B)}`;
}

/**
 * En-tête de la 2ᵉ section du panneau (stats sur la période). « Annualisé »
 * n'a de sens que pour des actifs investissables (prix / rendement total) hors
 * différence ; sinon on évite « rendement annualisé d'un taux/PER ».
 */
export function secondSectionTitle(operation: OperationKind, measure: TypeRef): string {
  if ((measure === 1 || measure === 2) && operation !== "difference") {
    return "Annualisé sur la période";
  }
  if (operation === "difference" && (measure === 3 || measure === 4)) {
    return "Statistiques du spread";
  }
  if (measure === 5) return "Valorisation sur la période";
  if (measure === 6) return "Volume sur la période";
  if (measure === 7) return "Change sur la période";
  return "Statistiques sur la période";
}

/** Titre du panneau de stats (nature des chiffres) selon l'opération et la mesure. */
export function buildStatsTitle(
  operation: OperationKind,
  a: TitledSeries,
  b: TitledSeries | null,
): string {
  // Si B est identique à A, on retombe sur la nature « une série ».
  const op = operation === "overlay" && b && sameSeries(a, b) ? "single" : operation;
  return STATS_TITLE[op][a.serie.type];
}

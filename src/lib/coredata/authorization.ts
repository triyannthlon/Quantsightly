// Algèbre typée des opérations de la page Exploration.
//
// Source : tableau d'autorisations de Yann (matrices figées pour l'instant —
// décision 2026-06-24, point 4 : encodées en TS, pas en base).
//
// Deux niveaux de contrainte :
//   1. TYPE_BY_CLASS  — quels `type` ont un sens pour une `class` donnée.
//   2. Les 4 opérations — quels couples (typeA, typeB) sont autorisés.

import type { ClassRef, TypeRef, OperationKind } from "./types";

// ─── 1. Types autorisés par classe ──────────────────────────────────────────

/** Pour chaque classe, la liste des types sémantiquement valides. */
export const TYPE_BY_CLASS: Record<ClassRef, TypeRef[]> = {
  1: [1, 2, 3, 4, 5], // indice boursier : prix, TR, yield, yield réel, PER
  2: [7], //             taux de change : spot uniquement
  3: [2, 3, 4], //       liquidité : TR, yield, yield réel
  4: [2, 3, 4], //       obligation 10 ans : TR, yield, yield réel
  5: [1], //             matière première : prix
  6: [1], //             crypto : prix
  7: [2, 3], //          inflation : TR, yield
  8: [4], //             croissance réelle : yield réel
  9: [6], //             commerce international : volume
  10: [1], //            base monétaire : prix
};

export function allowedTypesForClass(c: ClassRef): TypeRef[] {
  return TYPE_BY_CLASS[c] ?? [];
}

export function isTypeAllowedForClass(c: ClassRef, t: TypeRef): boolean {
  return allowedTypesForClass(c).includes(t);
}

/**
 * Mesures pour lesquelles une conversion de devise a du sens : prix (1) et
 * rendement total (2). Un taux, un PER ou un volume sont indépendants de la
 * devise → pas de conversion (devise verrouillée sur la native).
 */
export const CONVERTIBLE_MEASURES: ReadonlySet<TypeRef> = new Set<TypeRef>([1, 2]);

export function isConvertibleMeasure(t: TypeRef): boolean {
  return CONVERTIBLE_MEASURES.has(t);
}

// ─── 2. Opérations ──────────────────────────────────────────────────────────

/**
 * O1 — défaut 1 actif. Tout est autorisé sauf le spot (type 7), qui n'a de
 * sens qu'en ratio entre deux devises (O3).
 */
const SINGLE_ALLOWED_TYPES: ReadonlySet<TypeRef> = new Set<TypeRef>([1, 2, 3, 4, 5, 6]);

/**
 * Matrices TYPE×TYPE des opérations à deux actifs, sous forme d'adjacence
 * symétrique. Une clé absente signifie « ce type ne se combine avec aucun ».
 */
type PairMatrix = Partial<Record<TypeRef, TypeRef[]>>;

/** O2 — défaut 2 actifs (overlay) : grandeurs homogènes. */
const OVERLAY_PAIRS: PairMatrix = {
  1: [1, 2],
  2: [1, 2],
  3: [3, 4],
  4: [3, 4],
  5: [5],
};

/** O3 — ratio : prix-like entre eux, PER entre eux, spots entre eux (cross-FX). */
const RATIO_PAIRS: PairMatrix = {
  1: [1, 2],
  2: [1, 2],
  5: [5],
  7: [7],
};

/** O4 — différence : yields entre eux (spreads), PER entre eux. */
const DIFFERENCE_PAIRS: PairMatrix = {
  3: [3, 4],
  4: [3, 4],
  5: [5],
};

const TWO_ASSET_MATRIX: Record<Exclude<OperationKind, "single">, PairMatrix> = {
  overlay: OVERLAY_PAIRS,
  ratio: RATIO_PAIRS,
  difference: DIFFERENCE_PAIRS,
};

function isPairAllowed(
  op: Exclude<OperationKind, "single">,
  typeA: TypeRef,
  typeB: TypeRef,
): boolean {
  return TWO_ASSET_MATRIX[op][typeA]?.includes(typeB) ?? false;
}

/**
 * L'opération est-elle autorisée pour le(s) type(s) sélectionné(s) ?
 * `single` n'utilise que `typeA` ; les autres exigent `typeB`.
 */
export function isOperationAllowed(op: OperationKind, typeA: TypeRef, typeB?: TypeRef): boolean {
  if (op === "single") return SINGLE_ALLOWED_TYPES.has(typeA);
  if (typeB === undefined) return false;
  return isPairAllowed(op, typeA, typeB);
}

/**
 * Les opérations disponibles compte tenu du/des type(s) choisi(s).
 * Avec un seul actif → au plus `single`. Avec deux → overlay / ratio / difference.
 */
export function allowedOperations(typeA: TypeRef, typeB?: TypeRef): OperationKind[] {
  if (typeB === undefined) {
    return SINGLE_ALLOWED_TYPES.has(typeA) ? ["single"] : [];
  }
  return (["overlay", "ratio", "difference"] as const).filter((op) =>
    isPairAllowed(op, typeA, typeB),
  );
}

/**
 * Pour une opération à deux actifs et un premier type donné, les types
 * autorisés pour le second actif. Sert à filtrer le sélecteur B dans l'UI.
 */
export function allowedSecondTypes(
  op: Exclude<OperationKind, "single">,
  typeA: TypeRef,
): TypeRef[] {
  return TWO_ASSET_MATRIX[op][typeA] ?? [];
}

/** Identifiant canonique O1–O4 de chaque opération (table OPERATIONS). */
export const OPERATION_IDS: Record<OperationKind, "O1" | "O2" | "O3" | "O4"> = {
  single: "O1",
  overlay: "O2",
  ratio: "O3",
  difference: "O4",
};

/** Libellés FR des opérations (table OPERATIONS). */
export const OPERATION_LABELS: Record<OperationKind, string> = {
  single: "défaut 1 actif",
  overlay: "2 Séries",
  ratio: "ratio",
  difference: "différence",
};

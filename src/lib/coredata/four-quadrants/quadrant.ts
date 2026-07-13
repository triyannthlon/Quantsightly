import type { Quadrant } from "./types";

/**
 * Quadrant à partir des signes des coordonnées. Purement pédagogique : les
 * allocations utilisent les coordonnées et la zone de transition, pas ce label.
 * Départage des zéros : la coordonnée nulle est rattachée au pôle POSITIF
 * (boom / inflation), cas de bord improbable puisque les coordonnées sortent
 * d'un `tanh`.
 */
export function getQuadrant(x: number, y: number): Quadrant {
  const boom = x >= 0; // activité en expansion
  const inflation = y >= 0; // pression inflationniste
  if (boom && inflation) return "inflationary-boom";
  if (boom && !inflation) return "disinflationary-boom";
  if (!boom && inflation) return "inflationary-contraction";
  return "disinflationary-contraction";
}

/** Libellé du régime dans le vocabulaire Gave de l'app (cohérent avec `regime-palette`). */
export const QUADRANT_REGIME_FR: Record<Quadrant, string> = {
  "inflationary-boom": "Boom inflationniste",
  "disinflationary-boom": "Boom déflationniste",
  "inflationary-contraction": "Contraction inflationniste",
  "disinflationary-contraction": "Contraction déflationniste",
};

/** Pont vers les codes de `regime-palette` (TR/BR/TL/BL) pour réutiliser les teintes en UI. */
export const QUADRANT_TO_REGIME_CODE: Record<Quadrant, "TR" | "BR" | "TL" | "BL"> = {
  "inflationary-boom": "TR",
  "disinflationary-boom": "BR",
  "inflationary-contraction": "TL",
  "disinflationary-contraction": "BL",
};

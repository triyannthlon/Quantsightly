// Transformation de l'historique des régimes (par pays) en matrice prête à
// afficher : mois en colonnes, pays en lignes groupés par région géo. Pur (pas
// de DB) → appelé côté serveur dans page.tsx ; le client n'importe que les types.

import type { QuadrantHistoryResult, AxisSignal } from "@/lib/coredata/quadrant";

// Groupement géographique des lignes (table statique — l'assignation région est
// un choix éditorial, pas dérivable des données).
const COUNTRY_REGION: Record<string, string> = {
  US: "Amérique",
  CA: "Amérique",
  MX: "Amérique",
  BR: "Amérique",
  DE: "Europe",
  FR: "Europe",
  IT: "Europe",
  ES: "Europe",
  GB: "Europe",
  CH: "Europe",
  NO: "Europe",
  SE: "Europe",
  DK: "Europe",
  JP: "Asie-Pacifique",
  CN: "Asie-Pacifique",
  KR: "Asie-Pacifique",
  IN: "Asie-Pacifique",
  TW: "Asie-Pacifique",
  ID: "Asie-Pacifique",
  AU: "Asie-Pacifique",
  HK: "Asie-Pacifique",
  SG: "Asie-Pacifique",
};
const REGION_ORDER = ["Amérique", "Europe", "Asie-Pacifique", "Autres"];

// Encodage compact : 2 chars par mois = signal croissance + signal inflation
// (A accélère / D décélère / N neutre). ".." = pas de donnée. On garde les deux
// signaux (pas juste le quadrant) pour reconstituer le tooltip détaillé côté UI.
const SIG_CHAR: Record<AxisSignal, string> = {
  ACCELERATING: "A",
  DECELERATING: "D",
  NEUTRAL: "N",
};

export interface HistoryRow {
  code: string;
  name: string;
  /** 2 chars/mois alignés (croissance+inflation, A/D/N ; ".." = sans donnée). */
  cells: string;
}
export interface HistoryGroup {
  region: string;
  rows: HistoryRow[];
}
export interface HistoryMatrixData {
  /** Axe des mois (fins de mois `YYYY-MM-DD`), trié croissant. */
  months: string[];
  groups: HistoryGroup[];
}

export function buildHistoryMatrix(
  results: QuadrantHistoryResult[],
  nameByIso: Map<string, string>,
): HistoryMatrixData {
  const ok = results.filter((r) => r.status === "OK" && r.points.length > 0);

  const monthSet = new Set<string>();
  for (const r of ok) for (const p of r.points) monthSet.add(p.date);
  const months = [...monthSet].sort();
  const indexOf = new Map(months.map((m, i) => [m, i]));

  const rowsByRegion = new Map<string, HistoryRow[]>();
  for (const r of ok) {
    const cells = new Array<string>(months.length).fill("..");
    for (const p of r.points) {
      const i = indexOf.get(p.date);
      if (i !== undefined) cells[i] = SIG_CHAR[p.growthSignal] + SIG_CHAR[p.inflationSignal];
    }
    const region = COUNTRY_REGION[r.countryCode] ?? "Autres";
    const row: HistoryRow = {
      code: r.countryCode,
      name: nameByIso.get(r.countryCode) ?? r.countryCode,
      cells: cells.join(""),
    };
    const bucket = rowsByRegion.get(region);
    if (bucket) bucket.push(row);
    else rowsByRegion.set(region, [row]);
  }

  const groups: HistoryGroup[] = REGION_ORDER.filter((reg) => rowsByRegion.has(reg)).map((reg) => ({
    region: reg,
    rows: rowsByRegion.get(reg)!.sort((a, b) => a.code.localeCompare(b.code)),
  }));

  return { months, groups };
}

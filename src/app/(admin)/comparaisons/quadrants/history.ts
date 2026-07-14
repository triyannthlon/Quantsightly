// Transformation de l'historique des régimes (par pays) en matrice prête à
// afficher : mois en colonnes, pays en lignes groupés par région géo.
// ⚠️ Reclassifie depuis les COORDONNÉES `x,y` + la largeur de transition `T`
// choisie par l'utilisateur → appelé CÔTÉ CLIENT (T réactif).

import { getAxisSignal, type AxisSignal } from "@/lib/coredata/quadrant";

/** Série de coordonnées mensuelles d'un pays (payload serveur, léger). */
export interface CoordSeries {
  countryCode: string;
  points: { date: string; x: number; y: number }[];
}

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
// (A accélère / D décélère / N neutre). ".." = pas de donnée.
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
  series: CoordSeries[],
  nameByIso: Record<string, string>,
  transitionWidth: number,
): HistoryMatrixData {
  const ok = series.filter((s) => s.points.length > 0);

  const monthSet = new Set<string>();
  for (const s of ok) for (const p of s.points) monthSet.add(p.date);
  const months = [...monthSet].sort();
  const indexOf = new Map(months.map((m, i) => [m, i]));

  const rowsByRegion = new Map<string, HistoryRow[]>();
  for (const s of ok) {
    const cells = new Array<string>(months.length).fill("..");
    for (const p of s.points) {
      const i = indexOf.get(p.date);
      if (i !== undefined) {
        cells[i] = SIG_CHAR[getAxisSignal(p.x, transitionWidth)] + SIG_CHAR[getAxisSignal(p.y, transitionWidth)];
      }
    }
    const region = COUNTRY_REGION[s.countryCode] ?? "Autres";
    const row: HistoryRow = {
      code: s.countryCode,
      name: nameByIso[s.countryCode] ?? s.countryCode,
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

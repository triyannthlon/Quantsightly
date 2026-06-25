// Classification d'un signal macro : position du ratio vs sa MM7, avec bande de
// neutralité (zone de transition) et logique de confirmation (2 observations
// consécutives hors de la bande pour confirmer un changement de régime).

import type { EconomicDataPoint } from "@/lib/coredata/types";

export type TechnicalState = "above" | "below" | "near";
export type DisplayState = "positive" | "negative" | "transition";
export type Confidence = "forte" | "moyenne" | "faible";

export interface SignalClassification {
  /** Écart relatif du dernier point à sa MM7 (ratio / MM7 − 1). */
  ecart: number | null;
  technicalState: TechnicalState | null;
  displayState: DisplayState | null;
  confidence: Confidence | null;
  /** Dernier signal directionnel confirmé (2 obs consécutives). */
  confirmedDir: "above" | "below" | null;
  /** Date du dernier changement confirmé. */
  confirmedSince: string | null;
}

const EMPTY: SignalClassification = {
  ecart: null,
  technicalState: null,
  displayState: null,
  confidence: null,
  confirmedDir: null,
  confirmedSince: null,
};

export function classifySignal(
  ratio: EconomicDataPoint[],
  ma: EconomicDataPoint[],
  threshold: number,
): SignalClassification {
  const maByDate = new Map(ma.map((p) => [p.date, p.value]));

  // Points alignés avec leur écart relatif à la MM7.
  const pts: { date: string; ecart: number }[] = [];
  for (const r of ratio) {
    const m = maByDate.get(r.date);
    if (m !== undefined && m !== 0) pts.push({ date: r.date, ecart: r.value / m - 1 });
  }
  if (pts.length === 0) return EMPTY;

  const classify = (e: number): TechnicalState =>
    e > threshold ? "above" : e < -threshold ? "below" : "near";

  // Parcours pour la confirmation : un changement directionnel n'est confirmé
  // qu'après 2 observations consécutives hors de la bande.
  let confirmedDir: "above" | "below" | null = null;
  let confirmedSince: string | null = null;
  let prevDir: "above" | "below" | null = null;
  let streak = 0;
  for (const p of pts) {
    const dir = classify(p.ecart);
    if (dir === "near") {
      streak = 0;
      prevDir = null;
      continue;
    }
    if (dir === prevDir) streak += 1;
    else {
      streak = 1;
      prevDir = dir;
    }
    if (streak >= 2 && confirmedDir !== dir) {
      confirmedDir = dir;
      confirmedSince = p.date;
    }
  }

  const last = pts[pts.length - 1];
  const lastTech = classify(last.ecart);

  let displayState: DisplayState;
  let confidence: Confidence;
  if (lastTech === "near") {
    displayState = "transition";
    confidence = "faible";
  } else if (confirmedDir === lastTech) {
    displayState = lastTech === "above" ? "positive" : "negative";
    confidence = "forte";
  } else {
    // Hors bande mais changement pas encore confirmé (1 seule observation).
    displayState = "transition";
    confidence = "moyenne";
  }

  return { ecart: last.ecart, technicalState: lastTech, displayState, confidence, confirmedDir, confirmedSince };
}

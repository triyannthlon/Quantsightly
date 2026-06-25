// Lecture agrégée du régime à partir des signaux. Score par signal :
// positif = +1, négatif = −1, zone de transition = 0. Les deux axes (énergie =
// S&P/WTI, devise = oblig/or) donnent un quadrant SEULEMENT s'ils sont confirmés ;
// sinon le régime est « en transition » avec une confiance réduite.

import type { DisplayState, Confidence } from "./signal-classify";

export interface RegimeChip {
  label: string;
  tone: "positive" | "negative" | "neutral";
}

export interface AxisInput {
  displayState: DisplayState | null;
  confirmedDir: "above" | "below" | null;
}

export interface RegimeReading {
  chips: RegimeChip[];
  regimeLabel: string;
  regimeNote: string | null;
  confidence: Confidence;
  transitionSignal: string | null;
  lastConfirmed: string | null;
  synthesis: string;
  energyState: DisplayState | null;
  currencyState: DisplayState | null;
}

function quadrant(energyAbove: boolean, currencyAbove: boolean): { name: string; note: string } {
  if (energyAbove && currencyAbove) return { name: "Boom déflationniste", note: "régime de bonne devise" };
  if (energyAbove) return { name: "Boom inflationniste", note: "régime de mauvaise devise" };
  if (currencyAbove) return { name: "Contraction déflationniste", note: "régime de bonne devise" };
  return { name: "Stagflation", note: "régime de mauvaise devise" };
}

function score(s: DisplayState | null): number {
  return s === "positive" ? 1 : s === "negative" ? -1 : 0;
}

function chip(
  s: DisplayState | null,
  pos: string,
  neg: string,
  trans: string,
): RegimeChip | null {
  if (s === "positive") return { label: pos, tone: "positive" };
  if (s === "negative") return { label: neg, tone: "negative" };
  if (s === "transition") return { label: trans, tone: "neutral" };
  return null;
}

export function readRegime(
  energy: AxisInput,
  currency: AxisInput,
  actionsOr: DisplayState | null,
): RegimeReading {
  const e = score(energy.displayState);
  const c = score(currency.displayState);

  const chips = [
    chip(energy.displayState, "Énergie efficace", "Énergie peu efficace", "Énergie en transition"),
    chip(currency.displayState, "Devise solide", "Devise fragile", "Devise en transition"),
    chip(actionsOr, "Actions devant l'or", "Actions en retrait face à l'or", "Actions proches de l'or"),
  ].filter((x): x is RegimeChip => x !== null);

  const lastConfirmed =
    energy.confirmedDir && currency.confirmedDir
      ? quadrant(energy.confirmedDir === "above", currency.confirmedDir === "above").name
      : null;

  let regimeLabel: string;
  let regimeNote: string | null = null;
  let confidence: Confidence;
  let transitionSignal: string | null = null;
  let synthesis: string;

  if (e !== 0 && c !== 0) {
    const q = quadrant(e > 0, c > 0);
    regimeLabel = q.name;
    regimeNote = q.note;
    confidence = "forte";
    const energyPart = e > 0 ? "efficace en énergie" : "peu efficace en énergie";
    const currencyPart = c > 0 ? "une devise solide" : "une devise moins protectrice";
    const dominance =
      c < 0
        ? "Les actifs réels dominent les contrats."
        : "Les contrats jouent encore leur rôle de protection.";
    synthesis = `Le modèle lit aujourd'hui une économie ${energyPart}, avec ${currencyPart}. ${dominance}`;
  } else if (e !== 0 || c !== 0) {
    // Exactement un des deux axes est en zone de transition.
    if (c === 0) {
      transitionSignal = "qualité de la devise";
      regimeLabel = `Zone de transition entre ${quadrant(e > 0, true).name} et ${quadrant(e > 0, false).name}`;
    } else {
      transitionSignal = "efficacité énergétique";
      regimeLabel = `Zone de transition entre ${quadrant(true, c > 0).name} et ${quadrant(false, c > 0).name}`;
    }
    confidence = "moyenne";
    synthesis = `Un signal clé reste en zone de transition (${transitionSignal}) : le modèle conserve le dernier régime confirmé${
      lastConfirmed ? ` (${lastConfirmed})` : ""
    } et réduit le niveau de confiance.`;
  } else {
    regimeLabel = "Régime non confirmé";
    confidence = "faible";
    synthesis = lastConfirmed
      ? `Les deux signaux clés sont trop proches de leur tendance longue pour trancher. Dernier régime confirmé : ${lastConfirmed}.`
      : "Les deux signaux clés sont trop proches de leur tendance longue : le modèle ne confirme pas de régime.";
  }

  return {
    chips,
    regimeLabel,
    regimeNote,
    confidence,
    transitionSignal,
    lastConfirmed,
    synthesis,
    energyState: energy.displayState,
    currencyState: currency.displayState,
  };
}

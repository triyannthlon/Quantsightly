// Source unique de vérité pour la palette des régimes macro (couleur + libellé).
// Carte, légende, anneaux du 2×2, pastilles et titres de coin importent d'ici :
// changer une teinte = modifier UNE ligne, tout suit.
//
// ⚠️ Tailwind ne génère que les classes écrites EN TOUTES LETTRES dans le code
// source. Les chaînes ci-dessous sont littérales (pas de `bg-${hex}`) → elles
// sont bien détectées par le JIT. Pour changer une couleur, remplacer le hex
// dans TOUTES les chaînes de l'entrée concernée.

export type RegimeKey = "TR" | "BR" | "TL" | "BL" | "transition";

export interface RegimeStyle {
  /** Libellé FR du régime. */
  label: string;
  /** Couleur de référence (hex). */
  hex: string;
  /** Carte : aplat plein (fond + contour même couleur → fusion des voisins). */
  area: string;
  /** Pastille pleine (légende, liste, tooltip). */
  dot: string;
  /** Anneau du 2×2 : bordure douce. */
  ring: string;
  /** Anneau du 2×2 : fond intérieur léger. */
  ringBg: string;
  /** Titre de coin : soutenu en clair, pastel en sombre. */
  text: string;
}

/** Ordre canonique d'affichage (légende, liste). */
export const REGIME_ORDER: RegimeKey[] = ["TR", "BR", "TL", "BL", "transition"];

export const REGIME: Record<RegimeKey, RegimeStyle> = {
  TR: {
    label: "Boom inflationniste",
    hex: "#dcc08a",
    area: "fill-[#dcc08a] stroke-[#dcc08a]",
    dot: "bg-[#dcc08a]",
    ring: "border-[#dcc08a]/40",
    ringBg: "bg-[#dcc08a]/10",
    text: "text-amber-600 dark:text-[#dcc08a]",
  },
  BR: {
    label: "Boom déflationniste",
    hex: "#9ec9ae",
    area: "fill-[#9ec9ae] stroke-[#9ec9ae]",
    dot: "bg-[#9ec9ae]",
    ring: "border-[#9ec9ae]/40",
    ringBg: "bg-[#9ec9ae]/10",
    text: "text-emerald-600 dark:text-[#9ec9ae]",
  },
  TL: {
    label: "Contraction inflationniste",
    hex: "#dba7ad",
    area: "fill-[#dba7ad] stroke-[#dba7ad]",
    dot: "bg-[#dba7ad]",
    ring: "border-[#dba7ad]/40",
    ringBg: "bg-[#dba7ad]/10",
    text: "text-rose-600 dark:text-[#dba7ad]",
  },
  BL: {
    label: "Contraction déflationniste",
    hex: "#a7c0dd",
    area: "fill-[#a7c0dd] stroke-[#a7c0dd]",
    dot: "bg-[#a7c0dd]",
    ring: "border-[#a7c0dd]/40",
    ringBg: "bg-[#a7c0dd]/10",
    text: "text-blue-600 dark:text-[#a7c0dd]",
  },
  transition: {
    label: "Transition",
    hex: "#aab3c0",
    area: "fill-[#aab3c0] stroke-[#aab3c0]",
    dot: "bg-[#aab3c0]",
    ring: "border-[#aab3c0]/40",
    ringBg: "bg-[#aab3c0]/10",
    text: "text-slate-600 dark:text-[#aab3c0]",
  },
};

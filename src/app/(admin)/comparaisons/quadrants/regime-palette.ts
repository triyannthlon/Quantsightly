// Source unique de vérité pour la palette des régimes macro (couleur + libellé).
// Carte, légende, anneaux du 2×2, pastilles et titres de coin importent d'ici :
// changer une teinte = modifier UNE ligne, tout suit.
//
// STRATÉGIE (saturation ∝ 1/surface, 2 niveaux) :
//   - `area` = APLAT de la carte (grande surface) → teinte PASTEL douce (`hex`),
//              sinon un continent plein saturé est agressif.
//   - `dot` / `ring` / `ringBg` / `text` = PETITS éléments (pastilles, badges,
//              anneaux, barre, titres) → teinte INTERMÉDIAIRE (mélange 50/50 du
//              pastel et du vif Tailwind 500). Plus vive que la carte pour se
//              distinguer, mais assez proche pour rester harmonieuse.
//
// ⚠️ Tailwind ne génère que les classes écrites EN TOUTES LETTRES ici (pas de
// `bg-${x}`). Aplats + éléments = hex arbitraires ; texte = named (clair) +
// hex (sombre) pour la lisibilité sur cartouche clair.

export type RegimeKey = "TR" | "BR" | "TL" | "BL" | "transition";

export interface RegimeStyle {
  /** Libellé FR du régime. */
  label: string;
  /** Teinte pastel de l'aplat carte (hex de référence). */
  hex: string;
  /** Carte : aplat plein (fond + contour même couleur → fusion des voisins), PASTEL. */
  area: string;
  /** Pastille pleine (légende, liste, tooltip, barre, point carte), INTERMÉDIAIRE. */
  dot: string;
  /** Anneau du 2×2 : bordure, INTERMÉDIAIRE. */
  ring: string;
  /** Anneau du 2×2 : fond intérieur léger, INTERMÉDIAIRE. */
  ringBg: string;
  /** Titre de coin : soutenu en clair (named 600), intermédiaire en sombre. */
  text: string;
}

/** Ordre canonique d'affichage (légende, liste). */
export const REGIME_ORDER: RegimeKey[] = ["TR", "BR", "TL", "BL", "transition"];

export const REGIME: Record<RegimeKey, RegimeStyle> = {
  TR: {
    label: "Boom inflationniste",
    hex: "#dcc08a",
    area: "fill-[#e9af4b] stroke-[#e9af4b]",
    dot: "bg-[#e9af4b]",
    ring: "border-[#e9af4b]/40",
    ringBg: "bg-[#e9af4b]/10",
    text: "text-amber-600 dark:text-[#e9af4b]",
  },
  BR: {
    label: "Boom déflationniste",
    hex: "#9ec9ae",
    area: "fill-[#57c198] stroke-[#57c198]",
    dot: "bg-[#57c198]",
    ring: "border-[#57c198]/40",
    ringBg: "bg-[#57c198]/10",
    text: "text-emerald-600 dark:text-[#57c198]",
  },
  TL: {
    label: "Contraction inflationniste",
    hex: "#dba7ad",
    area: "fill-[#e87386] stroke-[#e87386]",
    dot: "bg-[#e87386]",
    ring: "border-[#e87386]/40",
    ringBg: "bg-[#e87386]/10",
    text: "text-rose-600 dark:text-[#e87386]",
  },
  BL: {
    label: "Contraction déflationniste",
    hex: "#a7c0dd",
    area: "fill-[#71a1ea] stroke-[#71a1ea]",
    dot: "bg-[#71a1ea]",
    ring: "border-[#71a1ea]/40",
    ringBg: "bg-[#71a1ea]/10",
    text: "text-blue-600 dark:text-[#71a1ea]",
  },
  transition: {
    label: "Transition",
    hex: "#aab3c0",
    area: "fill-[#8794a6] stroke-[#8794a6]",
    dot: "bg-[#8794a6]",
    ring: "border-[#8794a6]/40",
    ringBg: "bg-[#8794a6]/10",
    text: "text-slate-600 dark:text-[#8794a6]",
  },
};

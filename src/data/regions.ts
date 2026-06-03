/**
 * Mapping ISO2 → région macro pour les indices.
 *
 * Groupement volontairement coarse (7-8 régions) pour qu'une colonne
 * "Region" reste lisible dans la watchlist d'indices.
 *
 * Étendre la liste au fur et à mesure des indices ajoutés à la whitelist
 * `MAJOR_INDEX_CODES` côté backend C++.
 */

const REGION_BY_ISO2: Record<string, string> = {

    // ── Amérique du Nord ──────────────────────────────────
    US: "Amérique du Nord", CA: "Amérique du Nord", MX: "Amérique du Nord",

    // ── Europe ────────────────────────────────────────────
    FR: "Europe", DE: "Europe", GB: "Europe", IT: "Europe", ES: "Europe",
    NL: "Europe", BE: "Europe", CH: "Europe", SE: "Europe", DK: "Europe",
    NO: "Europe", FI: "Europe", AT: "Europe", IE: "Europe", PT: "Europe",
    PL: "Europe", CZ: "Europe", GR: "Europe", LU: "Europe", HU: "Europe",

    // ── Asie ──────────────────────────────────────────────
    JP: "Asie", HK: "Asie", SG: "Asie", KR: "Asie", TW: "Asie",
    CN: "Asie", IN: "Asie",

    // ── Pacifique ─────────────────────────────────────────
    AU: "Pacifique", NZ: "Pacifique",

    // ── Amérique latine ───────────────────────────────────
    BR: "Amérique latine", AR: "Amérique latine", CL: "Amérique latine",
    CO: "Amérique latine", PE: "Amérique latine",

    // ── Moyen-Orient ──────────────────────────────────────
    IL: "Moyen-Orient", AE: "Moyen-Orient", SA: "Moyen-Orient", TR: "Moyen-Orient",

    // ── Afrique ───────────────────────────────────────────
    ZA: "Afrique",
};



export function iso2ToRegion(iso2?: string): string | undefined
       {//iso2ToRegion

       /**
        * Renvoie la région macro associée à un code ISO2.
        *
        * @returns nom de la région ("Europe", "Asie", …) ou `undefined`
        *          si le code n'est pas mappé (indices globaux, codes inconnus).
        */

       if(!iso2) return undefined;

       return REGION_BY_ISO2[iso2.toUpperCase()];

       }//iso2ToRegion

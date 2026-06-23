import { unstable_cache } from "next/cache";
import { getDistinctValues } from "@/lib/coredata-db";
import { type Country, COUNTRIES_BY_LABEL } from "@/data/countries";
import { type Currency, CURRENCIES_BY_CODE } from "@/data/currencies";

export interface FilterOptions {
  countries: Country[];
  types: string[];
  classes: string[];
  currencies: Currency[];
}

export const getFilterOptions = unstable_cache(
  async (): Promise<FilterOptions> => {
    const [countryLabels, types, classes, ccyCodes] = await Promise.all([
      getDistinctValues("country"),
      getDistinctValues("type"),
      getDistinctValues("class"),
      getDistinctValues("ccy"),
    ]);

    const countries = [
      { code: "WORLD", label: "Monde" },
      ...countryLabels
        .filter((label) => label.toLowerCase() !== "monde")
        .map((label) => COUNTRIES_BY_LABEL.get(label.toLowerCase()))
        .filter((c): c is Country => c !== undefined),
    ];
    const currencies = ccyCodes
      .map((code) => CURRENCIES_BY_CODE.get(code) ?? { code, label: code })
      .filter((c): c is Currency => c !== undefined);

    return { countries, types, classes, currencies };
  },
  ["filter-options"],
  { revalidate: 3600 } /* re-interroge coredatadb toutes les heures */,
);

/*

Lance les 4 requêtes DB en parallèle
Résout chaque nom de pays → objet Country (avec le code ISO pour le drapeau)
Résout chaque code devise → objet Currency (avec le label français)
Si un code devise est inconnu de la liste statique, il passe quand même avec code comme label (fallback)

*/

/* Le cache d'unstable_cache est côté serveur, pas par session. Le cache est partagé entre tous les utilisateurs et toutes les sessions. */
/*
┌─────────────────────────────────┬────────────────────────────────┐
│            Situation            │          DB appelée ?          │
├─────────────────────────────────┼────────────────────────────────┤
│ Nouvelle session utilisateur    │ Non — même cache serveur       │
├─────────────────────────────────┼────────────────────────────────┤
│ Refresh navigateur              │ Non                            │
├─────────────────────────────────┼────────────────────────────────┤
│ Autre utilisateur               │ Non                            │
├─────────────────────────────────┼────────────────────────────────┤
│ Serveur redémarré (déploiement) │ Oui — cache vidé               │
├─────────────────────────────────┼────────────────────────────────┤
│ TTL d'1h écoulé                 │ Oui — revalidation silencieuse │
└─────────────────────────────────┴────────────────────────────────┘ */

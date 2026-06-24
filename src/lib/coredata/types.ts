// Types du domaine coredata (base `coredatadb`).
//
// Les références numériques `class` / `type` / `sector` sont les clés étrangères
// (smallint) vers les tables de nomenclature `classes` / `types` / `sectors`.
// On les modélise ici en unions de littéraux pour que l'algèbre d'autorisation
// (voir `authorization.ts`) soit vérifiée à la compilation.

/** Référence de classe d'actif (table `classes`). */
export type ClassRef = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Référence de type de donnée (table `types`). */
export type TypeRef = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Référence de secteur GICS (table `sectors`). Optionnel sur une série. */
export type SectorRef = 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 55 | 60;

/**
 * Opérations utilisateur de la page Exploration.
 *
 * À ne pas confondre avec la table `operations` de la base, qui décrit les
 * règles de *dérivation backend* (yield→prix, etc.). Ici il s'agit des 4
 * opérations d'affichage proposées à l'utilisateur :
 *
 * - `single`     → O1 : une seule série affichée
 * - `overlay`    → O2 : deux séries superposées (grandeurs homogènes)
 * - `ratio`      → O3 : ratio de deux séries
 * - `difference` → O4 : différence de deux séries (spreads)
 */
export type OperationKind = "single" | "overlay" | "ratio" | "difference";

/** Nomenclature résolue (une ligne d'une table de référence FR/EN). */
export interface RefLabel<R extends number = number> {
  reference: R;
  nameFr: string;
  nameEn: string;
}

/** Pays de la base coredata (porte le flag `reverse` essentiel à la conversion devise). */
export interface CoredataCountry {
  iso: string;
  nameFr: string;
  nameEn: string;
  currency: string;
  /**
   * Convention de cotation du spot de change.
   * - `false` (JPY, KRW…) : la valeur est "X devise locale pour 1 USD".
   * - `true`  (EUR, GBP…) : la valeur est "USD pour 1 devise locale" → à inverser.
   */
  reverse: boolean;
  daysBasis: number | null;
}

/** Tables de nomenclature chargées d'un coup (pour résoudre les libellés). */
export interface ReferenceData {
  classes: RefLabel<ClassRef>[];
  types: RefLabel<TypeRef>[];
  sectors: RefLabel<SectorRef>[];
  countries: CoredataCountry[];
}

/** Une série économique enrichie de ses libellés FR. */
export interface EconomicSeries {
  id: string;
  tickerName: string;
  countryIso: string;
  currency: string;
  class: ClassRef;
  type: TypeRef;
  sector: SectorRef | null;
  classFr: string;
  typeFr: string;
  sectorFr: string | null;
  countryFr: string | null;
  /** Flag `reverse` du pays de cotation (utile à la conversion devise). */
  countryReverse: boolean | null;
}

/** Un point d'une série temporelle. `date` est une chaîne ISO `YYYY-MM-DD`. */
export interface EconomicDataPoint {
  date: string;
  value: number;
}

/**
 * Taux de change d'une devise (série FX spot + flag `reverse`), pour la
 * conversion d'une série dans une devise d'affichage cible. USD est le pivot
 * et n'a pas de `FxRate` (facteur 1).
 */
export interface FxRate {
  currency: string;
  reverse: boolean;
  data: EconomicDataPoint[];
}

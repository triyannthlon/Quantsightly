import { getCountryQuadrantModel, listQuadrantCountries } from "@/lib/coredata/four-quadrants-service";
import { Lexique } from "@/components/custom/lexique/lexique";
import { QuadrantsView } from "./quadrants-view";

// Données live (coredata) — pas de prérendu statique.
export const dynamic = "force-dynamic";

const DEFAULT_COUNTRY = "US";

// Mots-clés expliqués dans le Lexique de la page (ordre = ordre des sections).
const LEXIQUE_TERMS = [
  // Portefeuille 4 Quadrants
  "q4-modele",
  "q4-coordonnees",
  "q4-strategie-binaire",
  "q4-strategie-dynamique",
  "q4-rotation",
  // Régime macro
  "regime",
  "quadrant",
  "croissance",
  "inflation",
  "boom-inflationniste",
  "boom-deflationniste",
  "contraction-inflationniste",
  "contraction-deflationniste",
  "zone-neutre",
  "mm7y",
  "conviction",
  // Nature des actifs
  "actif-reel",
  "cash",
  "obligation-longue",
  "or",
  // Performance
  "br-perf-annualisee",
  "br-perf-nominale",
  "br-perf-reelle",
  "br-perf-cumulee",
  "br-meilleure-annee",
  "br-pire-annee",
  // Risque
  "br-volatilite",
  "br-max-drawdown",
  "br-max-drawdown-nominal",
  "br-drawdown-courant",
  "br-duree-sous-eau",
  // Rendement-risque
  "br-sharpe",
  // Inflation & pouvoir d'achat
  "br-inflation-annualisee",
  "br-pouvoir-achat",
  // 4 Quadrants vs Actions
  "q4-vs-actions",
  "q4-ecart-rendement",
  "q4-reduction-drawdown",
  "q4-profil",
  "q4-regularite",
  // Données & graphes
  "br-echelle-log",
];

export default async function QuadrantsPage() {
  const [countries, initial] = await Promise.all([
    listQuadrantCountries(),
    getCountryQuadrantModel(DEFAULT_COUNTRY),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">4 Quadrants — Portefeuille macro</h1>
          <p className="text-sm text-muted-foreground">
            Une allocation de référence pilotée par le régime macroéconomique du pays : position dans le
            plan activité × inflation, dynamique du régime et allocation cible.
          </p>
        </div>
        <Lexique terms={LEXIQUE_TERMS} className="w-28" />
      </header>

      <QuadrantsView
        countries={countries}
        defaultCountry={DEFAULT_COUNTRY}
        initial={{
          config: initial.config,
          dataQuality: initial.dataQuality,
          signal: initial.signal,
          perf: initial.perf,
        }}
      />
    </div>
  );
}

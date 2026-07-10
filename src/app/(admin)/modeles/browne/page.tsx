import { getCountryBrowne, listBrowneCountries } from "@/lib/coredata/browne-service";
import { Lexique } from "@/components/custom/lexique/lexique";
import { BrowneView } from "./browne-view";

// Données live (coredata) — pas de prérendu statique.
export const dynamic = "force-dynamic";

const DEFAULT_COUNTRY = "US";

// Mots-clés expliqués dans le Lexique de la page (ordre = ordre des sections).
const LEXIQUE_TERMS = [
  // Portefeuille & pilotage
  "br-browne",
  "br-reequilibrage",
  "br-mode-analyse",
  "br-periode-backtest",
  "br-devise-analyse",
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
  "br-reduction-drawdown",
  // Rendement-risque
  "br-sharpe",
  // Inflation & pouvoir d’achat
  "br-inflation-annualisee",
  "br-ecart-inflation",
  "br-pouvoir-achat",
  "br-multiple-portefeuille",
  "br-multiple-inflation",
  "br-multiple-reel",
  // Comparaison & sources
  "br-comparaison-actions",
  "br-contribution",
  // Données & graphes
  "br-proxy-structurel",
  "br-qualite-donnees",
  "br-echelle-log",
  // Réutilisés du glossaire partagé (poches & données)
  "or",
  "cash",
  "actif-reel",
  "data-obligation-10a",
  "data-taux-change",
  "mesure-prix-coupons",
  "inflation",
  "proxy",
];

export default async function BrownePage() {
  const [countries, initial] = await Promise.all([
    listBrowneCountries(),
    getCountryBrowne(DEFAULT_COUNTRY),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Browne — Portefeuille permanent</h1>
          <p className="text-sm text-muted-foreground">
            Tester la robustesse d’un portefeuille 25/25/25/25 construit localement pour chaque pays.
          </p>
        </div>
        <Lexique terms={LEXIQUE_TERMS} />
      </header>

      <BrowneView
        countries={countries}
        defaultCountry={DEFAULT_COUNTRY}
        initial={{ config: initial.config, dataQuality: initial.dataQuality, input: initial.input }}
      />
    </div>
  );
}

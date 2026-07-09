import { getCountryBrowne, listBrowneCountries } from "@/lib/coredata/browne-service";
import { BrowneView } from "./browne-view";

// Données live (coredata) — pas de prérendu statique.
export const dynamic = "force-dynamic";

const DEFAULT_COUNTRY = "US";

export default async function BrownePage() {
  const [countries, initial] = await Promise.all([
    listBrowneCountries(),
    getCountryBrowne(DEFAULT_COUNTRY),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Browne — Portefeuille permanent</h1>
        <p className="text-sm text-muted-foreground">
          Tester la robustesse d’un portefeuille 25/25/25/25 construit localement pour chaque pays.
        </p>
      </header>

      <BrowneView
        countries={countries}
        defaultCountry={DEFAULT_COUNTRY}
        initial={{ config: initial.config, dataQuality: initial.dataQuality, input: initial.input }}
      />
    </div>
  );
}

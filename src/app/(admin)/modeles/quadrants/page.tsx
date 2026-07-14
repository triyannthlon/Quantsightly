import { getCountryQuadrantModel, listQuadrantCountries } from "@/lib/coredata/four-quadrants-service";
import { QuadrantsView } from "./quadrants-view";

// Données live (coredata) — pas de prérendu statique.
export const dynamic = "force-dynamic";

const DEFAULT_COUNTRY = "US";

export default async function QuadrantsPage() {
  const [countries, initial] = await Promise.all([
    listQuadrantCountries(),
    getCountryQuadrantModel(DEFAULT_COUNTRY),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">4 Quadrants — Portefeuille macro</h1>
        <p className="text-sm text-muted-foreground">
          Une allocation de référence pilotée par le régime macroéconomique du pays : position dans le
          plan activité × inflation, dynamique du régime et allocation cible.
        </p>
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

import { computeAllCountryQuadrants } from "@/lib/coredata/quadrant-service";
import { getReferenceData } from "@/lib/coredata";
import type { QuadrantResult } from "@/lib/coredata/quadrant";
import type { QuadrantPoint } from "./quadrant-map";
import { QuadrantsView } from "./quadrants-view";

type OkResult = Extract<QuadrantResult, { status: "OK" }>;

// Données live (coredata) — pas de prérendu statique.
export const dynamic = "force-dynamic";

function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}

export default async function QuadrantsPage() {
  const [results, ref] = await Promise.all([
    computeAllCountryQuadrants(),
    getReferenceData(),
  ]);

  const nameByIso = new Map(ref.countries.map((c) => [c.iso, c.nameFr]));
  const ok = results.filter((r): r is OkResult => r.status === "OK");
  const points: QuadrantPoint[] = ok.map((r) => ({
    countryCode: r.countryCode,
    name: nameByIso.get(r.countryCode) ?? r.countryCode,
    growthSignal: r.growthSignal,
    inflationSignal: r.inflationSignal,
  }));
  const asOf = ok[0]?.date ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Régimes économiques</h1>
        <p className="text-sm text-muted-foreground">
          Positionnement des pays selon le couple croissance × inflation
          {asOf && <> — données à fin {formatMonth(asOf)}</>}.
        </p>
      </header>

      <QuadrantsView points={points} asOfLabel={asOf ? formatMonth(asOf) : null} />
    </div>
  );
}

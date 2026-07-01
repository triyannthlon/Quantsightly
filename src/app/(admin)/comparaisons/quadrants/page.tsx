import { computeAllCountryQuadrantHistory } from "@/lib/coredata/quadrant-service";
import { getReferenceData } from "@/lib/coredata";
import type { QuadrantHistoryResult } from "@/lib/coredata/quadrant";
import type { QuadrantPoint } from "./quadrant-map";
import { buildHistoryMatrix } from "./history";
import { QuadrantsView } from "./quadrants-view";
import { Lexique } from "@/components/custom/lexique/lexique";

type OkHistory = Extract<QuadrantHistoryResult, { status: "OK" }>;

// Mots-clés expliqués dans le Lexique de cette page (3 groupes).
const LEXIQUE_TERMS = [
  // Régime macro
  "regime",
  "quadrant",
  "croissance",
  "inflation",
  "boom-inflationniste",
  "boom-deflationniste",
  "contraction-inflationniste",
  "contraction-deflationniste",
  "transition",
  // Nature des actifs
  "action-croissance",
  "action-value",
  "actif-reel",
  "contrat",
  "cash",
  "obligation-longue",
  "or",
  "matieres-premieres",
  // Calcul des signaux
  "proxy",
  "mm7y",
  "signal-positif",
  "signal-negatif",
  "zone-neutre",
  "conviction",
];

// Données live (coredata) — pas de prérendu statique.
export const dynamic = "force-dynamic";

function formatMonth(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(iso),
  );
}

export default async function QuadrantsPage() {
  const [results, ref] = await Promise.all([
    computeAllCountryQuadrantHistory(),
    getReferenceData(),
  ]);

  const nameByIso = new Map(ref.countries.map((c) => [c.iso, c.nameFr]));
  const ok = results.filter((r): r is OkHistory => r.status === "OK" && r.points.length > 0);

  // Régime courant = dernier point de l'historique (identique à computeAllCountryQuadrants).
  const points: QuadrantPoint[] = ok.map((r) => {
    const last = r.points[r.points.length - 1];
    return {
      countryCode: r.countryCode,
      name: nameByIso.get(r.countryCode) ?? r.countryCode,
      growthSignal: last.growthSignal,
      inflationSignal: last.inflationSignal,
    };
  });
  const asOf = ok.reduce<string | null>((mx, r) => {
    const d = r.points[r.points.length - 1].date;
    return !mx || d > mx ? d : mx;
  }, null);

  const history = buildHistoryMatrix(results, nameByIso);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Régimes macroéconomiques</h1>
          <p className="text-sm text-muted-foreground">
            Positionnement des pays selon les dynamiques macroéconomiques de croissance et
            d’inflation
            {asOf && <> — données à fin {formatMonth(asOf)}</>}.
          </p>
        </div>
        <Lexique terms={LEXIQUE_TERMS} />
      </header>

      <QuadrantsView
        points={points}
        asOfLabel={asOf ? formatMonth(asOf) : null}
        history={history}
      />
    </div>
  );
}

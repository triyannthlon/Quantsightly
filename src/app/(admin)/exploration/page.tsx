import { listSeries, getReferenceData, getFxRates, type OperationKind } from "@/lib/coredata";
import { ExplorationCanvas } from "./exploration-canvas";

const OPERATIONS: OperationKind[] = ["single", "overlay", "ratio", "difference"];

// Catalogue économique (coredatadb) chargé côté serveur. Le catalogue est petit
// (~340 séries) : on le passe en entier au client, qui dérive la cascade de
// sélection (pays → classe → mesure → devise) sans aller-retour réseau. Les taux
// FX (une série spot par devise) sont chargés en même temps pour la conversion.
//
// Deep-link : `?a={serieId}&b={serieId}&op=ratio` pré-remplit le comparateur
// (utilisé par les cartes Signaux pour « ouvrir dans le comparateur »).
export default async function ExplorationPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; op?: string }>;
}) {
  const [sp, [series, reference, fxRates]] = await Promise.all([
    searchParams,
    Promise.all([listSeries(), getReferenceData(), getFxRates()]),
  ]);

  const initialA = sp.a ? series.find((s) => s.id === sp.a) : undefined;
  const initialB = sp.b ? series.find((s) => s.id === sp.b) : undefined;
  const initialOperation =
    sp.op && OPERATIONS.includes(sp.op as OperationKind) ? (sp.op as OperationKind) : undefined;

  return (
    <ExplorationCanvas
      series={series}
      reference={reference}
      fxRates={fxRates}
      initialA={initialA}
      initialB={initialB}
      initialOperation={initialOperation}
    />
  );
}

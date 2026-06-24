import { listSeries, getReferenceData, getFxRates } from "@/lib/coredata";
import { ExplorationCanvas } from "./exploration-canvas";

// Catalogue économique (coredatadb) chargé côté serveur. Le catalogue est petit
// (~340 séries) : on le passe en entier au client, qui dérive la cascade de
// sélection (pays → classe → mesure → devise) sans aller-retour réseau. Les taux
// FX (une série spot par devise) sont chargés en même temps pour la conversion.
export default async function ExplorationPage() {
  const [series, reference, fxRates] = await Promise.all([
    listSeries(),
    getReferenceData(),
    getFxRates(),
  ]);
  return <ExplorationCanvas series={series} reference={reference} fxRates={fxRates} />;
}

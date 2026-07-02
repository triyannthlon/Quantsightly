import { listSeries, getReferenceData, getFxRates } from "@/lib/coredata";
import { ExplorationCanvas } from "./exploration-canvas";
import { parseComparatorView, type ComparatorSearchParams } from "./deep-link";

// Catalogue économique (coredatadb) chargé côté serveur. Le catalogue est petit
// (~340 séries) : on le passe en entier au client, qui dérive la cascade de
// sélection (pays → classe → mesure → devise) sans aller-retour réseau. Les taux
// FX (une série spot par devise) sont chargés en même temps pour la conversion.
//
// Deep-link : `?a=&b=&op=&curA=&curB=&ma=&from=&to=` restaure la vue à l'identique
// (séries, opération, devises, moyenne mobile, plage). Utilisé par « Ouvrir dans
// le comparateur » (Mes comparaisons), les cartes Signaux et « Copier le lien ».
export default async function ExplorationPage({
  searchParams,
}: {
  searchParams: Promise<ComparatorSearchParams>;
}) {
  const [sp, [series, reference, fxRates]] = await Promise.all([
    searchParams,
    Promise.all([listSeries(), getReferenceData(), getFxRates()]),
  ]);

  const initialA = sp.a ? series.find((s) => s.id === sp.a) : undefined;
  const initialB = sp.b ? series.find((s) => s.id === sp.b) : undefined;
  const view = parseComparatorView(sp);

  return (
    <ExplorationCanvas
      series={series}
      reference={reference}
      fxRates={fxRates}
      initialA={initialA}
      initialB={initialB}
      initialOperation={view.operation}
      initialCurrencyA={view.currencyA}
      initialCurrencyB={view.currencyB}
      initialShowMA={view.showMA}
      initialMaYears={view.maYears}
      initialFrom={view.from}
      initialTo={view.to}
    />
  );
}

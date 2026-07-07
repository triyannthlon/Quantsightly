import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import { listSeries, getFxRates, getSeriesData, type EconomicDataPoint } from "@/lib/coredata";
import { buildComparison } from "../build-comparison";
import { MesComparaisonsGrid, type SavedView } from "./mes-grid";
import type { ComparisonConfig } from "../comparison";
import { comparatorHref } from "../../exploration/deep-link";

// « Mes comparaisons » : reconstruit chaque graphique épinglé depuis sa config.
export default async function MesComparaisonsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [rows, series, fxRates] = await Promise.all([
    prisma.savedComparator.findMany({
      where: { userId: user.id },
      orderBy: [{ positionRank: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, config: true },
    }),
    listSeries(),
    getFxRates(),
  ]);

  const byId = new Map(series.map((s) => [s.id, s]));

  const views = (
    await Promise.all(
      rows.map(async (row): Promise<SavedView | null> => {
        const config = JSON.parse(row.config) as ComparisonConfig;
        const serieA = byId.get(config.serieAId);
        if (!serieA) return null; // série disparue du catalogue → on ignore
        const serieB = config.serieBId ? byId.get(config.serieBId) : undefined;

        const [dataA, dataB] = await Promise.all([
          getSeriesData(serieA.id),
          serieB
            ? getSeriesData(serieB.id)
            : Promise.resolve<EconomicDataPoint[] | undefined>(undefined),
        ]);

        const result = buildComparison({
          serieA,
          dataA,
          serieB,
          dataB,
          operation: config.operation,
          currencyA: config.currencyA,
          currencyB: config.currencyB,
          showMA: config.showMA,
          maYears: config.maYears,
          from: config.from,
          to: config.to,
          fxRates,
        });

        // « Ouvrir dans le comparateur » : le lien porte toute la config
        // (devises, MM, plage) pour restaurer la vue à l'identique.
        const href = comparatorHref(config);

        return { id: row.id, title: row.title, exploreHref: href, ...result };
      }),
    )
  ).filter((v): v is SavedView => v !== null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Mon cockpit</h1>
        <p className="text-sm text-muted-foreground">
          Votre espace personnel : les graphiques que vous avez épinglés depuis le comparateur.
        </p>
      </header>
      <MesComparaisonsGrid initial={views} />
    </div>
  );
}

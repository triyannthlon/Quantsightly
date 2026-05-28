
import { unstable_cache }          from "next/cache";
import { getHierarchyRows }        from "@/lib/coredata-db";
import { COUNTRIES_BY_LABEL }      from "@/data/countries";

// [countryCode] -> [class] -> [type] -> ccy
export type SeriesHierarchy = Record<string, Record<string, Record<string, string>>>;

export const getSeriesHierarchy = unstable_cache(
  async (): Promise<SeriesHierarchy> => {
    const rows = await getHierarchyRows();
    const hierarchy: SeriesHierarchy = {};

    for (const row of rows) {
      const country  = COUNTRIES_BY_LABEL.get(row.country.toLowerCase());
      const code     = country?.code ?? row.country;

      if (!hierarchy[code])              hierarchy[code]              = {};
      if (!hierarchy[code][row.class])   hierarchy[code][row.class]   = {};
      if (!hierarchy[code][row.class][row.type]) {
        hierarchy[code][row.class][row.type] = row.ccy;
      }
    }

    return hierarchy;
  },
  ["series-hierarchy"],
  { revalidate: 3600 }
);
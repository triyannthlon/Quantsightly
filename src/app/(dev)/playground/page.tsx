import { getFilterOptions }    from "@/lib/filter-options";
import { getSeriesHierarchy }  from "@/lib/series-hierarchy";
import { PlaygroundClient }    from "./PlaygroundClient";

export default async function PlaygroundPage() {
  const [options, hierarchy] = await Promise.all([
    getFilterOptions(),
    getSeriesHierarchy(),
  ]);
  return <PlaygroundClient options={options} hierarchy={hierarchy} />;
}
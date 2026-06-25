import { fetchAuth } from "@/lib/api/fetch-auth";
import type { ComparisonConfig, SavedComparison } from "./comparison";

/** Épingle une comparaison ; renvoie la comparaison créée ou null en cas d'échec. */
export async function saveComparison(
  title: string,
  config: ComparisonConfig,
): Promise<SavedComparison | null> {
  const res = await fetchAuth("/api/me/comparators", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, config }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { comparison: SavedComparison };
  return data.comparison;
}

/** Retire une comparaison épinglée. */
export async function deleteComparison(id: string): Promise<boolean> {
  const res = await fetchAuth(`/api/me/comparators/${id}`, { method: "DELETE" });
  return res.ok;
}

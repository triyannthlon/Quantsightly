// Barrel PUR du module de comparaison de modèles (« 4 Quadrants vs Browne »).
// Importable côté client (aucun accès base). Le chargement des séries se fait par
// le service serveur / la page (`signal` + `perf` déjà chargés), puis
// `computeModelComparison` tourne côté client, instantanément, comme les autres
// onglets 4Q.

export * from "./types";
export * from "./metrics";
export * from "./registry";
export * from "./engine";
export * from "./guard";

// Barrel de la couche domaine PURE du module « 4 Quadrants ». Sans accès base :
// importable côté client (contrairement au barrel `@/lib/coredata`). Le
// chargement des séries + la conversion de devise vivront dans un service serveur
// dédié, sur le modèle de `quadrant-service.ts` / `browne-service.ts`.

export * from "./types";
export * from "./settings";
export * from "./ratios";
export * from "./robust-normalization";
export * from "./coordinates";
export * from "./quadrant";
export * from "./transition";
export * from "./allocation-binary";
export * from "./allocation-dynamic";
export * from "./energy-overlay";
export * from "./kinematics";
export * from "./build-model";
export * from "./backtest";

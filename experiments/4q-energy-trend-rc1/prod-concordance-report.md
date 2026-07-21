# `energy-trend-v1` — concordance de PRODUCTION

Service `getCountryQuadrantModel(code, {strategy}, "v2", overlay)`. Référence = candidat validé `4q-energy-trend-rc1` (simulateRc1). US, FR, JP, BR × {dynamique, binaire}.

## 1. `QS_ENERGY_OVERLAY=off` = `4q-standard-v2` bit à bit
  ✅ US·dynamic OFF = v2 — real 6.347 vs 6.347, énergie détenue 0
  ✅ FR·dynamic OFF = v2 — real 5.479 vs 5.479, énergie détenue 0
  ✅ JP·dynamic OFF = v2 — real 5.404 vs 5.404, énergie détenue 0
  ✅ BR·dynamic OFF = v2 — real 5.936 vs 5.936, énergie détenue 0
  ✅ US·binary OFF = v2 — real 7.631 vs 7.631, énergie détenue 0
  ✅ FR·binary OFF = v2 — real 5.899 vs 5.899, énergie détenue 0
  ✅ JP·binary OFF = v2 — real 6.526 vs 6.526, énergie détenue 0
  ✅ BR·binary OFF = v2 — real 5.432 vs 5.432, énergie détenue 0

## 2. `QS_ENERGY_OVERLAY=trend-v1` = candidat validé `rc1` (Dynamique & Binaire)
  ✅ US·dynamic ON = rc1 — rdt 2.5e-16 · rot 0.0e+0 · poids finaux 0.0e+0
  ✅ FR·dynamic ON = rc1 — rdt 1.5e-16 · rot 0.0e+0 · poids finaux 0.0e+0
  ✅ JP·dynamic ON = rc1 — rdt 1.7e-16 · rot 0.0e+0 · poids finaux 0.0e+0
  ✅ BR·dynamic ON = rc1 — rdt 1.6e-16 · rot 0.0e+0 · poids finaux 0.0e+0
  ✅ US·binary ON = rc1 — rdt 1.6e-16 · rot 0.0e+0 · poids finaux 0.0e+0
  ✅ FR·binary ON = rc1 — rdt 1.6e-16 · rot 0.0e+0 · poids finaux 0.0e+0
  ✅ JP·binary ON = rc1 — rdt 1.7e-16 · rot 0.0e+0 · poids finaux 0.0e+0
  ✅ BR·binary ON = rc1 — rdt 1.5e-16 · rot 0.0e+0 · poids finaux 0.0e+0

## 3. `trend-v1` reproduit les golden du candidat (Dynamique, série mensuelle)
  ✅ US dyn = golden candidat — écart max 5.0e-9 sur 377 mois
  ✅ FR dyn = golden candidat — écart max 5.0e-9 sur 264 mois
  ✅ JP dyn = golden candidat — écart max 5.0e-9 sur 377 mois
  ✅ BR dyn = golden candidat — écart max 5.0e-9 sur 212 mois

## 4. Golden de production figés (Dyn + Bin)
  ✅ golden production Dyn + Bin figés — US/FR/JP/BR × {dynamique, binaire}

## 5. Indisponibilité = raison explicite (jamais silent OFF)
  ✅ série Énergie trouée → statut d'indisponibilité explicite (pas OFF silencieux) — NON_CONTIGUOUS_HISTORY / non_contiguous_history

## Confirmation
- **`QS_ENERGY_OVERLAY=off` = `4q-standard-v2` inchangé** (Dynamique & Binaire) — perfs, cibles, poids détenus, rotation, métriques.
- **`QS_ENERGY_OVERLAY=trend-v1` Dynamique = candidat validé.**
- **`QS_ENERGY_OVERLAY=trend-v1` Binaire = candidat validé.**

## Bilan : 22 ✅ / 0 ❌
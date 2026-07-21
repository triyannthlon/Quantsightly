# Recette STAGING — `QS_ENERGY_OVERLAY=trend-v1` (data+code, sans UI)

## 0. Lecture de la configuration
  ✅ défaut (env absent) = off — off
  ✅ valeur inconnue = off (sûr) — off
  ✅ `trend-v1` reconnu — trend-v1
  ✅ `off` explicite = off — off

## 1. `QS_ENERGY_OVERLAY=trend-v1` — sorties moteur (env lu par le service)
  ✅ US·dynamic : signal inactif, cible 5 poches Σ=1, dispo OK — Énergie cible 0 %, détenue 0.0 %, rot 41.2 %, 1995-01→2026-06
  ✅ FR·dynamic : signal inactif, cible 5 poches Σ=1, dispo OK — Énergie cible 0 %, détenue 0.0 %, rot 50.1 %, 2004-06→2026-06
  ✅ JP·dynamic : signal inactif, cible 5 poches Σ=1, dispo OK — Énergie cible 0 %, détenue 0.0 %, rot 45.2 %, 1995-01→2026-06
  ✅ BR·dynamic : signal inactif, cible 5 poches Σ=1, dispo OK — Énergie cible 0 %, détenue 0.0 %, rot 57.4 %, 2008-10→2026-06
  ✅ US·binary : signal inactif, cible 5 poches Σ=1, dispo OK — Énergie cible 0 %, détenue 0.0 %, rot 67.3 %, 1995-01→2026-06
  ✅ FR·binary : signal inactif, cible 5 poches Σ=1, dispo OK — Énergie cible 0 %, détenue 0.0 %, rot 76.9 %, 2004-06→2026-06
  ✅ JP·binary : signal inactif, cible 5 poches Σ=1, dispo OK — Énergie cible 0 %, détenue 0.0 %, rot 68.8 %, 1995-01→2026-06
  ✅ BR·binary : signal inactif, cible 5 poches Σ=1, dispo OK — Énergie cible 0 %, détenue 0.0 %, rot 134.9 %, 2008-10→2026-06

## 2. Conversion de devise (poche Énergie en local, signal mondial USD)
  ✅ signal Énergie mondial (identique US/FR au dernier mois) — US 0 = FR 0
  ✅ devises locales distinctes (US USD / FR EUR) — USD / EUR

## 3. `QS_ENERGY_OVERLAY=off` — retour à v2 (le flag modifie le comportement)
  ✅ US·dynamic OFF : aucune poche Énergie (= v2) — énergie détenue 0
  ✅ US·binary OFF : aucune poche Énergie (= v2) — énergie détenue 0
  ✅ le flag CHANGE réellement la sortie (rotation ON ≠ OFF) — rot ON 41.2 % vs OFF 24.2 %

## 4. Robustesse données (aucune indisponibilité silencieuse)
  ✅ batch complet : 22/22 pays OK, dispo explicite — statuts dispo : OK

## Snapshot du dernier mois (trend-v1)
| pays·strat | mois | signal | énergie cible | énergie détenue | rotation | devise | qualité |
|---|---|---|---|---|---|---|---|
| US·dynamic | 2026-06 | inactif (score 0) | 0 % | 0.0 % | 41.2 % | USD | Complet |
| FR·dynamic | 2026-06 | inactif (score 0) | 0 % | 0.0 % | 50.1 % | EUR | Complet |
| JP·dynamic | 2026-06 | inactif (score 0) | 0 % | 0.0 % | 45.2 % | JPY | Complet |
| BR·dynamic | 2026-06 | inactif (score 0) | 0 % | 0.0 % | 57.4 % | BRL | Complet |
| US·binary | 2026-06 | inactif (score 0) | 0 % | 0.0 % | 67.3 % | USD | Complet |
| FR·binary | 2026-06 | inactif (score 0) | 0 % | 0.0 % | 76.9 % | EUR | Complet |
| JP·binary | 2026-06 | inactif (score 0) | 0 % | 0.0 % | 68.8 % | JPY | Complet |
| BR·binary | 2026-06 | inactif (score 0) | 0 % | 0.0 % | 134.9 % | BRL | Complet |

## Bilan recette : 18 ✅ / 0 ❌

⚠️ Recette DATA+CODE (pas de serveur live ; l'auth OTP empêche les captures UI auto). Aucune UI, aucune bascule publique. Rollback = `QS_ENERGY_OVERLAY=off` + rebuild.
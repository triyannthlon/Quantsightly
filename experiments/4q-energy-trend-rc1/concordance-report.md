# `4q-energy-trend-rc1` — rapport de concordance

Candidat FIGÉ : signal `SPDYENT_t > SMA6`, poids Énergie **10 %**, financement prorata, UNE bande v2 (δ=5) sur 5 poches, coûts au compounding. Référence indépendante = moteur `backtestQuadrants`. 21 pays.

## Concordance — 10 points

**1. `w=0` reproduit `4q-standard-v2` bit à bit** (Énergie no-op, même fenêtre)
  ✅ US rc1(w=0)=v2 — écart max rendement mensuel 1.7e-16
  ✅ FR rc1(w=0)=v2 — écart max rendement mensuel 1.6e-16
  ✅ JP rc1(w=0)=v2 — écart max rendement mensuel 1.6e-16
  ✅ BR rc1(w=0)=v2 — écart max rendement mensuel 1.7e-16

**2. rc1 (L6/w10) reproduit exactement le moteur `backtestQuadrants`** (rendements, rotation, poids finaux)
  ✅ US rc1=moteur — rdt 2.5e-16 · rot 0.0e+0 · détenu 0.0e+0 · cible 0.0e+0
  ✅ FR rc1=moteur — rdt 1.5e-16 · rot 0.0e+0 · détenu 0.0e+0 · cible 0.0e+0
  ✅ JP rc1=moteur — rdt 1.7e-16 · rot 0.0e+0 · détenu 0.0e+0 · cible 0.0e+0
  ✅ BR rc1=moteur — rdt 1.6e-16 · rot 0.0e+0 · détenu 0.0e+0 · cible 0.0e+0

**3. Aucune information de t+1 dans le signal de t** (causalité)
  ✅ signal ≤ t inchangé quand t+1… modifié — 0 divergence(s) avant 2015-06

**4. Première activation possible après 6 observations seulement**
  ✅ 1er signal = 6ᵉ mois — 1er signal 1995-06, 6ᵉ mois 1995-06

**5. Mois manquant/invalide → signal indisponible (aucune interpolation)**
  ✅ trou → 6 fenêtres indisponibles, reprise ensuite — trou ok=true, reprise=true
  ✅ valeur ≤ 0 → mois exclu, pas d'interpolation

**6. Conversion SPDYENT→locale = convention des autres actifs mondiaux (or)**
  ✅ FR conversion cohérente (or‖énergie même méthode) — 378 pts, USD-identité=true
  ✅ US conversion cohérente (or‖énergie même méthode) — 378 pts, USD-identité=true

**7. Bande appliquée UNE seule fois sur la cible 5 poches** — impliqué par le point 2 (rc1 = moteur, qui applique une bande unique sur les 5 poches).
  ✅ bande unique (⊂ point 2) — concordance moteur = bande unique sur 5 poches

**8. Rotation & coûts uniquement sur transactions exécutées (bande qui bloque = 0 coût)**
  ✅ mois bloqués par la bande présents (turnover=0, aucun coût) — 234 mois conservés
  ✅ frontière w=5 % : activations bloquées par la bande à la frontière δ=5 — 3/36 activations bloquées · détenu w5 3.15% < w10 6.20%

**9. Poids détenus/cibles conservés, somme = 100 % après dérive**
  ✅ Σ poids détenus & cibles = 1 (tous mois, tous pays reps) — écart max 3.3e-16

**10. Déterministe & reproductible**
  ✅ deux exécutions identiques — CAGR 7.431947

## Tests de frontière
  ✅ SPDYENT = SMA6 → INACTIF (strict >) — série plate → jamais actif
  ✅ transition 0→10 % présente
  ✅ transition 10→0 % présente
  ✅ épisodes d'activation détectés — 33 épisodes
  ✅ cible = prorata de la base v2 du mois (alloc nat + signal simultanés)
  ✅ données insuffisantes → statut non-OK — INSUFFICIENT_HISTORY
  ✅ discontinuité perf (2010-06) → NON_CONTIGUOUS_HISTORY — NON_CONTIGUOUS_HISTORY
  ✅ forte variation + conversion (BR) : rc1 = moteur — écart max 1.6e-16

## Golden fixtures
  ✅ golden replay déterministe (rendements mensuels identiques) — 4 pays, série complète figée
  Golden figé : US, FR, JP, BR — horizons, épisodes, rotation, coûts, série mensuelle (poids détenus/cibles). Épisodes couverts inclus 2007-2009, 2014-2016, 2020-2023, 2025-2026.

## Comparaison — v2 · rc1 (L6/w10) · contrôle (L6/w15) · Énergie toujours 10 %
| variante | ΔSharpe Max | ΔCAGR Max | ΔSharpe pré-2021 | ΔSharpe post-lanc |
|---|---|---|---|---|
| **rc1 (L6/w10)** | +0.128 | +0.84 | +0.070 | +0.108 |
| contrôle (L6/w15) | +0.163 | +1.23 | +0.085 | +0.136 |
| Énergie toujours 10 % | +0.033 | +0.13 | -0.073 | +0.002 |

→ La valeur PROPRE du filtre = rc1 − toujours-investi (le filtre récupère la traîne de l'actif brut).

## Confirmation du plateau & réserves
**Plateau L=4-7 robuste** (cf. `../4q-energie-v2/trend-confirm-report.md`, sans-2021-2022 > 0 sur L=4-7, cassure nette L≥8) — mais **seul L=6/w10 constitue la spec rc1**. `w=15 %` = variante de sensibilité documentée, non retenue comme principale (exposition plus prudente).

**Réserves explicites (rappel pour la décision d'intégration ultérieure) :**
- **2021-2022 reste le principal épisode** (≈ 53 % du gain à L=6) ; le résultat **hors 2021-2022 demeure positif**, mais l'épisode pèse.
- **La rotation augmente** (≈ +17 pt/an vs v2, déjà nette de coûts) — surveiller en exécution réelle.
- **Le signal RAPIDE (L≤7) est indispensable** : les filtres lents (L≥8-9) échouent (dominés par 2021-2022).
- **La validation utilise le MÊME historique qui a servi à découvrir l'hypothèse** (L=6 identifié au bord de grille puis confirmé) — pas d'out-of-sample temporel réellement neuf ; prudence.

## Bilan : 28 ✅ / 0 ❌
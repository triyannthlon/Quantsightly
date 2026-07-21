# Protocole de comparaison normalisée — `v2` / `rc1` / Browne

**⚠️ SPÉCIFICATION — NON EXÉCUTÉE.** À lancer UNIQUEMENT après validation par Yann du candidat
`4q-energy-trend-rc1` ET de ce protocole. Aucune page produit, aucun défaut, aucun tag ne doit
bouger. Ce document définit la comparaison ; il ne la réalise pas.

## 1. Objet

Comparer, sur une base strictement identique, trois portefeuilles de référence :

1. **`4q-standard-v2`** — 4 Quadrants, stratégie dynamique, zone neutre T=20, bande de réallocation
   δ=5, 4 poches, mensuel (socle de production actuel).
2. **`4q-energy-trend-rc1`** — `v2` + surcouche Énergie de tendance (SMA6, poids 10 %, prorata, une
   bande sur 5 poches) — cf. `README.md` (spec figée).
3. **Browne** — portefeuille permanent 25/25/25/25, rééquilibrage **annuel** (définition actuelle,
   `computeBrowne` / `browne-service`), devise locale.

## 2. Base commune (équité de la comparaison)

Tout doit être identique entre les trois, sauf la mécanique propre à chaque modèle.

- **Pays** : les 21 pays éligibles (`listQuadrantCountries`, DK exclu — signal trop court). Chaque
  pays comparé à lui-même sur les trois modèles.
- **Devise** : locale, pour les trois. Or, pétrole (signal v2/rc1) et SPDYENT convertis via
  `convertCurrency` (date exacte) — même méthode partout.
- **Inflation** : le **même CPI** local par pays. Toutes les métriques principales sont **réelles**
  (déflatées par ce CPI).
- **Coûts** : **même modèle** pour les trois — coût = `bps · 2 · turnover exécuté`, intégré au
  **compounding** (convention étude 2 / rc1). Barème : **25 bps principal**, **50 bps stress**, 0 bps
  référence. La rotation de Browne provient de son rééquilibrage annuel ; celle de v2/rc1 de la bande
  mensuelle — mais le **barème de coût est le même**.
- **Fenêtre** : deux lectures, à présenter séparément :
  - **(A) Fenêtre commune STRICTE** (tête-à-tête) : par pays, intersection où les **trois** modèles
    sont calculables = `max(start_v2, start_rc1, start_browne) → min(end…)`. rc1 est borné par SPDYENT
    (1995→) ; Browne par le cash (certains pays tardifs) ; v2 par 167 mois de signal. La fenêtre stricte
    peut donc raccourcir certains pays — **c'est le prix de l'équité**. Headline = cette fenêtre.
  - **(B) Fenêtre native de chaque modèle** (contexte) : chaque modèle sur son historique maximal,
    pour situer les ordres de grandeur. Ne sert PAS au verdict tête-à-tête.

## 3. Métriques (identiques pour les trois)

Par pays puis agrégées (médiane / Q1 / Q3 / pire décile / % pays) :

- CAGR réel net · Sharpe réel (excédent sur le cash local réel) · volatilité réelle ·
  max drawdown réel · durée sous l'eau · rotation annualisée · fréquence de réallocation.
- Écarts pertinents : `rc1 − v2` (effet propre de la surcouche), `v2 − Browne`, `rc1 − Browne`.

## 4. Dimensions d'analyse

- **Agrégat** de robustesse (pas de moyenne seule) : médiane + quartiles + pire décile + % pays.
- **Sous-périodes** : 1995-2000 · 2001-2005 · 2006-2010 · 2011-2015 · 2016-2020 · 2021-2026 ·
  **pré-2021** · **post-lancement de l'indice (2011-02→)**.
- **Épisodes Énergie** (pour rc1) : liste, contribution, leave-one-episode-out, retrait 2007-2008,
  retrait 2021-2022, part du meilleur épisode — pour rappeler la dépendance à 2021-2022.
- **Horizons** : Max / 20A / 10A / 5A (stabilité).
- **Dispersion inter-pays** + **leave-one-country-out** (informatif pour la conversion locale, cf.
  réserve : ne valide pas un signal mondial).

## 5. Règles d'équité & garde-fous

- `rc1 ⊇ v2` : rc1 = v2 + surcouche → `rc1 − v2` isole l'effet Énergie (déjà mesuré : +0,128 Sharpe
  Max, réserve 2021-2022). La comparaison à Browne positionne les **familles de modèles**.
- Browne garde sa **définition actuelle** (annuel, 25/25/25/25) — on ne l'optimise pas.
- Cellule rc1 = **L6/w10 uniquement** (w15 = sensibilité, hors headline).
- Même harnais de mesure (déflation, Sharpe excédent-cash, coûts au compounding) pour les trois →
  réutiliser `measureRc1` et l'étendre aux séries Browne (mêmes conventions), avec **auto-vérification**
  que `v2` via ce harnais reproduit le socle production, et que Browne via ce harnais reproduit
  `computeBrowne` (net de coûts).
- **Rapport** distinct des trois modèles + écarts, avec les réserves rc1 rappelées explicitement.

## 6. Choix de conception à confirmer par Yann AVANT exécution

1. **Fenêtre headline** : commune stricte (A) recommandée pour le tête-à-tête, native (B) en contexte.
   → confirmer que le verdict porte sur (A).
2. **Rééquilibrage Browne** : conservé **annuel** (définition actuelle). → confirmer.
3. **Taux sans risque du Sharpe** : cash **local réel** (convention v2/Browne existante). → confirmer.
4. **Barème de coût** appliqué aussi à Browne (annuel) : oui, même modèle. → confirmer.
5. **Périmètre pays** : 21 (DK exclu). → confirmer, ou inclure DK en « historique court ».

## 7. Sortie attendue (une fois validé)

Un unique harnais `comparison.mts` (lecture seule, `experiments/`) →
`comparison-report.md` : tableaux par modèle + écarts + sous-périodes + épisodes + horizons +
dispersion, sur la fenêtre commune stricte (A) et en contexte native (B). **Aucune** modification de
page produit, de défaut ou de tag — la comparaison éclaire une **décision ultérieure**, elle ne
l'exécute pas.

# Étude Énergie — vérification finale des invariants

> Passe de contrôle **avant archivage** (Yann, 2026-07-21). Chaque garantie est **testée**
> par `verify.mts` (lecture seule), pas seulement affirmée. **Résultat : 11/11 OK, 0 échec.**

| # | Invariant | Méthode de test | Résultat |
|---|---|---|---|
| 1 | **Reproduction exacte de Standard v1** (`w_max=0`, sans énergie) | Comparer, sur les 21 pays, mon backtest `w_max=0` (plein historique) au socle du service `getCountryQuadrantModel` (CAGR réel, MDD, Sharpe, rotation, mois) | **écart max = 0,00e+0** (identité parfaite) |
| 2 | **Fenêtre commune 1995** | Témoin (avec série énergie) : `start` de chaque pays | toutes ≥ **1995-01** |
| 2b | **Comparaison à périmètre égal** | Témoin vs config énergie : mêmes `start`/`end` | **identiques** pour les 21 pays |
| 3 | **Pas de conversion pour l'USD** | `toLocal(energyUSD, "USD")` | série **inchangée** |
| 3b | **Conversion effective hors USD** | FR/JP/CH : `energyLocal ≠ energyUSD` | **converti** |
| 3c | **Formule FX = celle de l'or** | `value_local == value_usd ÷ usdPerUnit(date)` sur échantillons | **écart relatif max = 0,00e+0** |
| 4 | **Normalisation à 100 %** | Σ des 5 poches sur **14 172** cas (4 pays × 3 financements × 4 formes extrêmes × tous mois) | **écart max = 2,2e-16** (epsilon machine) |
| 4b | **Aucun poids négatif** | min des 5 poches sur les mêmes cas | **min = 0,00e+0** |
| 5 | **`t → t+1`, zéro look-ahead** | courbe nominale démarre à 100 (aucun rendement le mois d'entrée) ; nb de pas = nb de mois | **OK** (493 mois / 493 pas) |
| 6 | **Coûts de transaction cohérents** | drag = `bps·2·rotation`, monotone en bps | US 36,8 %/an → **0,074 / 0,184 / 0,368 %/an** |

**Preuve code du `t→t+1`** (moteur non modifié) : dans `backtest.ts`, le rendement du mois `j`
utilise `w = wByMonth.get(rows[j-1])` (poids figés à la **clôture de `j-1`**) appliqué à
`rows[j]/rows[j-1] − 1` ; l'overlay Énergie est calculé sur les coordonnées `(x,y)` **du mois `t`**
et appliqué au mois suivant. Aucune information future n'entre dans une décision.

**Coûts** : le drag est une **approximation analytique conservatrice** (rotation annualisée ×
volume brut `2×` × coût), appliquée en post-traitement au rendement réel ; elle ne modifie ni la
volatilité ni le drawdown (impact du second ordre). Documentée dans `etude-energie-synthese.md`.

## Versions des données & paramètres (instantané 2026-07-21)

- **Poche Énergie** : `MXWO0EN Index-XX-1-2` (MSCI World Energy TR) — **1995-01-31 → 2026-06-30**, 378 pts, 0 trou.
- **Pétrole signal** : `CL1 comdty-XX-5-1` (WTI générique, PX_LAST) — 1960-01-31 → 2026-06-30.
- **Or** : `XAU Comdty-XX-5-1` (1971-08 → 2026-06). **CPI / actions / oblig / cash** : par pays (cf. audit).
- **Panel** : 21 pays (DK exclu — 21 mois).
- **Grille (5 184 cellules)** : `w_max ∈ {0,5,10,15,20,25,30} %` × `T_E ∈ {0,10,20,30,40,50}` ×
  `shape ∈ {step, ramp}` × `finance ∈ {prorata, boombloc, cash}` × `strategy ∈ {dynamic, binary}` ×
  `T ∈ {0,20,50}` × `horizon ∈ {Max(1995→), 20A, 10A, 5A}` ; coûts 10/25/50 bps.
- **Moteur** : socle figé `four-quadrants/` — **aucune modification** (overlay appliqué en couche
  expérimentale externe, réutilise `applyEnergyOverlay`/`backtestQuadrants` purs).
- **Commit de base** : `60ac363` (socle `4q-standard-v1`).

## Conclusion de la vérification
Les six familles d'invariants demandées sont **satisfaites**. Les résultats de l'étude
(`etude-energie-synthese.md`) reposent donc sur un pipeline **sans fuite temporelle, à périmètre de
comparaison égal, en devise locale correcte, poids normalisés, et reproduisant exactement le socle**.
La conclusion de **non-intégration** est fiable.

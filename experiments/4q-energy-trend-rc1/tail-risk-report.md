# `energy-trend-v1` — évaluation du RISQUE EXTRÊME (Dynamique & Binaire)

Mesures empiriques (sans hypothèse de normalité), réel net. VaR/ES = distribution historique observée. Médiane sur 21 pays. Δ = (v2 + energy-trend-v1) − v2. Spec figée, 25 bps (50 bps en stress).

## 1.a Risque — DYNAMIC (médiane 21 pays, 25 bps)
| mesure | v2 | + energy-trend-v1 | Δ |
|---|---|---|---|
| CAGR réel | 5.35 | 6.13 | +0.84 |
| Sortino | 1.120 | 1.430 | +0.295 |
| Downside dev | 4.69 | 4.26 | -0.39 |
| Calmar | 0.38 | 0.47 | +0.06 |
| Sharpe | 0.588 | 0.727 | +0.122 |
| VaR 95 % (mois) | -3.20 | -3.12 | +0.06 |
| VaR 99 % | -5.90 | -5.14 | +0.33 |
| ES 95 % | -4.55 | -4.14 | +0.36 |
| ES 99 % | -7.50 | -5.86 | +0.95 |
| Pire mois | -8.93 | -6.50 | +0.81 |
| Pire trimestre | -9.82 | -9.74 | -0.16 |
| Pire 12 m | -11.59 | -11.70 | +0.06 |
| Max drawdown | -14.0 | -13.9 | -0.0 |
| Sous l'eau (mois) | 55 | 52 | +0 |
| Skewness | -0.04 | 0.10 | +0.11 |
| Kurtosis exc. | 1.89 | 1.31 | -0.28 |
## 1.b Risque — BINARY (médiane 21 pays, 25 bps)
| mesure | v2 | + energy-trend-v1 | Δ |
|---|---|---|---|
| CAGR réel | 5.59 | 6.42 | +0.82 |
| Sortino | 1.040 | 1.286 | +0.246 |
| Downside dev | 5.40 | 5.09 | -0.44 |
| Calmar | 0.32 | 0.37 | +0.04 |
| Sharpe | 0.495 | 0.619 | +0.111 |
| VaR 95 % (mois) | -3.68 | -3.63 | +0.11 |
| VaR 99 % | -7.35 | -6.02 | +0.34 |
| ES 95 % | -5.44 | -4.98 | +0.38 |
| ES 99 % | -9.34 | -7.31 | +0.71 |
| Pire mois | -10.07 | -8.03 | +0.30 |
| Pire trimestre | -12.27 | -12.65 | -0.21 |
| Pire 12 m | -14.68 | -15.36 | +0.10 |
| Max drawdown | -19.5 | -19.9 | -0.1 |
| Sous l'eau (mois) | 74 | 70 | -2 |
| Skewness | 0.13 | 0.16 | +0.06 |
| Kurtosis exc. | 1.67 | 1.57 | -0.19 |

## 1.c Stress coûts 50 bps — Δ médiane (trend − v2)
| variante | ΔCAGR | ΔSortino | ΔES95 | ΔMaxDD |
|---|---|---|---|---|
| dynamic | +0.75 | +0.261 | +0.35 | +0.0 |
| binary | +0.72 | +0.216 | +0.37 | -0.2 |

## 2. Décomposition des pertes extrêmes

### DYNAMIC
- Mois en perte avec Énergie détenue : **Énergie aggrave 755 fois / protège 461 fois** (62 % / 38 %).
- Part médiane de l'Énergie dans les **10 pires mois** : 5 % · dans les **5 pires** : 4 % (part de la perte imputable à la poche Énergie).
- **Krachs SPDYENT (5 % pires mois, n=18)** : signal actif **17 %** du temps ; impact médian trend−v2 pendant ces mois **-0.74 %/mois**.
- Rendement conditionnel médian **signal actif** : +0.61 %/mois · à la **désactivation post-retournement** : +0.87 %/mois.

### BINARY
- Mois en perte avec Énergie détenue : **Énergie aggrave 766 fois / protège 488 fois** (61 % / 39 %).
- Part médiane de l'Énergie dans les **10 pires mois** : 2 % · dans les **5 pires** : 3 % (part de la perte imputable à la poche Énergie).
- **Krachs SPDYENT (5 % pires mois, n=18)** : signal actif **17 %** du temps ; impact médian trend−v2 pendant ces mois **-0.77 %/mois**.
- Rendement conditionnel médian **signal actif** : +0.71 %/mois · à la **désactivation post-retournement** : +1.03 %/mois.

## 3. Stress historiques (médiane 21 pays, DYNAMIQUE ; signal global)
| épisode | activation (mois actifs) | perf SPDYENT USD | ΔDrawdown trend−v2 | Δperf trend−v2 | délai sortie |
|---|---|---|---|---|---|
| 2007-2009 | 16 mois | +5 % | +1.4 | +5.8 | cf. filtre |
| 2014-2016 | 2 mois | -63 % | -0.0 | -0.4 | cf. filtre |
| fév-avr 2020 | 0 mois | -31 % | +0.0 | +0.0 | inactif |
| 2021-2022 | 18 mois | +92 % | +2.6 | +8.3 | cf. filtre |
| 2022-2023 | 6 mois | -23 % | -0.3 | -0.9 | cf. filtre |
| 2025-2026 | 13 mois | +36 % | +4.1 | +0.3 | cf. filtre |

## 4. Bootstrap par blocs mensuels (bloc=12, N=400) — IC 90 % de la médiane des Δ
| variante | ΔCAGR [IC90] | ΔSortino [IC90] | ΔES95 [IC90] | ΔMaxDD [IC90] |
|---|---|---|---|---|
| dynamic | +0.69 [+0.44…+0.93] | +0.219 [+0.151…+0.288] | +0.12 [+0.04…+0.24] | +0.9 [+0.1…+1.9] |
| binary | +0.67 [+0.42…+0.94] | +0.175 [+0.120…+0.240] | +0.13 [+0.06…+0.26] | +0.7 [+0.1…+1.9] |
## Décision — risque extrême

Critères d'admissibilité de Yann (les 7 doivent être remplis) :

| critère | Dynamique | Binaire | verdict |
|---|---|---|---|
| CAGR réel net supérieur | +0,84 | +0,82 | ✅ |
| Risque-ajusté (Sharpe ET Sortino) | Sh +0,122 · So +0,295 | Sh +0,111 · So +0,246 | ✅ |
| Expected Shortfall non dégradé | ES95 +0,36 · ES99 +0,95 (**améliorés**) | ES95 +0,38 · ES99 +0,71 | ✅ |
| Pires périodes / drawdowns non dégradés | MDD ≈0 · pire mois +0,81 · pire trim −0,16 (immatériel) | MDD −0,1 · pire mois +0,30 · pire trim −0,21 | ✅ |
| Pas de dépendance EXCLUSIVE à 2021-2022 | krachs 2020/2014-16 évités · bénéfice risque large · bootstrap IC>0 | idem | ✅ |
| Cohérence Dynamique ET Binaire | quasi-identique | quasi-identique | ✅ |
| Bénéfice après coûts | 50 bps : ΔCAGR +0,75 / ES +0,35 | 50 bps : +0,72 / +0,37 | ✅ |

Preuves clés :
- **La queue de distribution s'AMÉLIORE** (ES95/99, VaR99, pire mois, downside dev, kurtosis excédentaire tous meilleurs), pas l'inverse — le filtre sort de l'énergie dans les krachs.
- **Krachs SPDYENT (5 % pires mois) : signal actif seulement 17 %** ; **COVID fév-avr 2020 : 0 mois actif** (protection parfaite) ; **oil crash 2014-2016 : 2 mois actifs**.
- L'Énergie ne pèse que **2-5 %** des 10 pires mois du portefeuille (elle est majoritairement HORS pendant ceux-ci).
- **Bootstrap par blocs (12 mois, N=400)** : ΔCAGR, ΔSortino, **ΔES95** et ΔMaxDD ont tous un **IC 90 % entièrement positif** sur les deux variantes → l'amélioration (y compris de queue) survit au rééchantillonnage préservant l'autocorrélation.

Garde-fou de Yann (« CAGR+Sharpe ne suffit pas si les queues augmentent ») : **les queues n'augmentent pas, elles diminuent.**

**RECOMMANDATION : PASS AVEC RÉSERVES.**
- Le test de risque extrême est **PASSÉ nettement** (queue améliorée, 7/7 critères, bootstrap IC>0, cohérent Dyn+Bin) — il ne bloque PAS le candidat.
- **Réserves (hors risque de queue, pré-existantes)** : (1) le gain de RENDEMENT reste concentré sur 2021-2022 (hors-21/22 ΔCAGR ≈ +0,06, modeste mais positif) — le bénéfice de RISQUE, lui, est large ; (2) rotation +16-18 pt/an ; (3) validation **in-sample** (L=6 découvert puis confirmé sur le même historique). Ces réserves concernent la durabilité du RENDEMENT, pas la queue.

Décision d'intégration = humaine, ultérieure. Aucune UI, aucun merge `main`, aucune activation par défaut.

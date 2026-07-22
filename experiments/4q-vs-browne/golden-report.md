# Golden — 4 Quadrants vs Browne (US/FR/JP/BR)

Moteur de comparaison PUR, public = `4q-standard-v2` (bande δ=5), coûts **25 bps** sur rotation exécutée, aucune poche Énergie. Observation LECTURE SEULE.

## Contrôle « fenêtre commune stricte » (mode nominal, Max)

| pays | Browne seul (mois) | 3 stratégies (mois) | début commun | dates identiques |
|---|---|---|---|---|
| US | 659 | 493 | 1985-06 | ✅ |
| FR | 431 | 265 | 2004-06 | ✅ |
| JP | 659 | 493 | 1985-06 | ✅ |
| BR | 378 | 213 | 2008-10 | ✅ |

## Comparaison — mode Nominal, Max, 25 bps

### US — fenêtre 1985-06 → 2026-06 (493 mois)

| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| browne | 1785.91 | 7.43 | 5.94 | 0.64 | 2.25 | -12.8 | 22 | -9.7 | -3.29 | 0.04 | 1 | 0.86 |
| quadrants-dynamic-v2 | 3586.86 | 9.2 | 7.51 | 0.74 | 2.21 | -11.5 | 28 | -8.57 | -4.26 | 0.24 | 3.39 | 4.96 |
| quadrants-binary-v2 | 5670.18 | 10.4 | 9.06 | 0.75 | 2.03 | -15.14 | 25 | -9.3 | -5.21 | 0.46 | 2.05 | 9.35 |

### FR — fenêtre 2004-06 → 2026-06 (265 mois)

| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| browne | 270.58 | 6.13 | 5.79 | 0.86 | 1.87 | -8.18 | 16 | -6.71 | -3.3 | 0.04 | 1 | 0.47 |
| quadrants-dynamic-v2 | 346.73 | 7.04 | 7.31 | 0.8 | 1.66 | -13.11 | 27 | -10.86 | -4.43 | 0.32 | 4.09 | 3.56 |
| quadrants-binary-v2 | 374.03 | 7.33 | 8.61 | 0.72 | 1.44 | -19.57 | 60 | -17.18 | -5.24 | 0.58 | 2.45 | 6.34 |

### JP — fenêtre 1985-06 → 2026-06 (493 mois)

| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| browne | 462.65 | 4.3 | 6.35 | 0.47 | 1.04 | -16.55 | 71 | -16.55 | -4 | 0.05 | 1 | 0.96 |
| quadrants-dynamic-v2 | 1011.9 | 6.05 | 7.39 | 0.64 | 1.35 | -19.06 | 45 | -16.99 | -4.67 | 0.25 | 3.24 | 5.16 |
| quadrants-binary-v2 | 1546.3 | 7.07 | 9 | 0.64 | 1.28 | -25.88 | 67 | -24.45 | -5.82 | 0.45 | 2.02 | 9.33 |

### BR — fenêtre 2008-10 → 2026-06 (213 mois)

| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| browne | 715.4 | 12.61 | 7.2 | 0.43 | 3.69 | -8.71 | 24 | -5.52 | -3.45 | 0.06 | 1.02 | 0.49 |
| quadrants-dynamic-v2 | 610.87 | 11.74 | 8.12 | 0.27 | 2.67 | -12.94 | 23 | -4.77 | -4.64 | 0.4 | 4.92 | 3.5 |
| quadrants-binary-v2 | 508.35 | 10.76 | 10.72 | 0.12 | 1.58 | -23.44 | 35 | -8.33 | -6.56 | 1.2 | 4.64 | 10.61 |


## Comparaison — mode Réel, Max, 25 bps

### US — fenêtre 1985-06 → 2026-06 (493 mois)

| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| browne | 507.03 | 4.5 | 6.06 | 0.61 | 1.22 | -18.84 | 47 | -16.17 | -3.54 | 0.04 | 1 | 0.86 |
| quadrants-dynamic-v2 | 1086.71 | 6.22 | 7.61 | 0.71 | 1.38 | -18.43 | 57 | -15.08 | -4.45 | 0.24 | 3.39 | 4.96 |
| quadrants-binary-v2 | 1757.29 | 7.39 | 9.11 | 0.72 | 1.34 | -15.95 | 59 | -12.13 | -5.42 | 0.46 | 2.05 | 9.35 |

### FR — fenêtre 2004-06 → 2026-06 (265 mois)

| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| browne | 158.88 | 4.42 | 6.07 | 0.81 | 1.22 | -12.16 | 32 | -11.11 | -3.56 | 0.04 | 1 | 0.47 |
| quadrants-dynamic-v2 | 212.07 | 5.31 | 7.54 | 0.77 | 1.18 | -14.01 | 27 | -11.64 | -4.58 | 0.32 | 4.09 | 3.56 |
| quadrants-binary-v2 | 231.14 | 5.59 | 8.81 | 0.69 | 1.04 | -20.41 | 78 | -17.9 | -5.38 | 0.58 | 2.45 | 6.34 |

### JP — fenêtre 1985-06 → 2026-06 (493 mois)

| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| browne | 315.92 | 3.54 | 6.48 | 0.45 | 0.82 | -20.36 | 168 | -18 | -4.15 | 0.05 | 1 | 0.96 |
| quadrants-dynamic-v2 | 721.92 | 5.27 | 7.5 | 0.62 | 1.13 | -21.9 | 77 | -20.18 | -4.79 | 0.25 | 3.24 | 5.16 |
| quadrants-binary-v2 | 1116.96 | 6.28 | 9.1 | 0.63 | 1.11 | -27.93 | 103 | -26.37 | -5.91 | 0.45 | 2.02 | 9.33 |

### BR — fenêtre 2008-10 → 2026-06 (213 mois)

| stratégie | cumulé % | CAGR % | vol % | Sharpe | Sortino | MaxDD % | sous eau (m) | pire 12m % | ES95 % | rotation %/an | réalloc/an | coûts cumulés % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| browne | 206.78 | 6.55 | 7.53 | 0.39 | 1.5 | -22.04 | 47 | -15.44 | -4.09 | 0.06 | 1.02 | 0.49 |
| quadrants-dynamic-v2 | 167.45 | 5.73 | 8.35 | 0.25 | 1.1 | -19.86 | 55 | -14.76 | -5.16 | 0.4 | 4.92 | 3.5 |
| quadrants-binary-v2 | 128.88 | 4.8 | 10.79 | 0.11 | 0.65 | -23.84 | 62 | -13.4 | -7.01 | 1.2 | 4.64 | 10.61 |

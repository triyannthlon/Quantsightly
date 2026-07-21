# Étude Énergie v2 — 3 architectures de signal MONDE (préenregistré)

Δ = variante Énergie − `4q-standard-v2` (w=0), 21 pays, dyn/T20, net 25 bps, prorata, bande unique sur 5 poches, SPDYENT investi, t→t+1.

## 1. Fréquence d'activation du gate par tranche (seuils = 20)
| architecture | 95-00 | 01-05 | 06-10 | 11-15 | 16-20 | 21-26 |
|---|---|---|---|---|---|---|
| A (y>20 inflation) | 0% | 28% | 100% | 52% | 18% | 100% |
| B (x<-20 pétrole) | 6% | 90% | 100% | 47% | 0% | 20% |
| C (x<-20 ∧ y>20) | 0% | 28% | 100% | 47% | 0% | 20% |

## 2. Médiane ΔSharpe par sous-période (w=10 %) — le gain survit-il HORS 2021-2022 ?
| cellule | Max | **pré-2021** | **Live11-20** | 21-26 | Live11-26 |
|---|---|---|---|---|---|
| A·Ty0 | +0.057 | -0.017 | -0.061 | +0.315 | +0.059 |
| A·Ty20 | +0.063 | -0.014 | -0.038 | +0.315 | +0.083 |
| A·Ty40 | +0.063 | -0.011 | -0.024 | +0.315 | +0.089 |
| B·Tx0 | -0.006 | +0.013 ⬅ | -0.010 | -0.042 | -0.022 |
| B·Tx20 | +0.011 | +0.005 ⬅ | -0.012 | +0.022 | +0.003 |
| B·Tx40 | +0.012 | -0.006 | -0.023 | +0.051 | +0.006 |
| C·Tx0·Ty0 | -0.008 | +0.004 ⬅ | -0.013 | -0.042 | -0.023 |
| C·Tx0·Ty20 | -0.013 | +0.003 ⬅ | -0.011 | -0.042 | -0.021 |
| C·Tx0·Ty40 | -0.018 | -0.010 | -0.017 | -0.042 | -0.026 |
| C·Tx20·Ty0 | +0.011 | +0.005 ⬅ | -0.012 | +0.022 | +0.003 |
| C·Tx20·Ty20 | +0.009 | +0.000 | -0.012 | +0.022 | +0.003 |
| C·Tx20·Ty40 | +0.001 | -0.010 | -0.019 | +0.022 | -0.002 |
| C·Tx40·Ty0 | +0.014 | -0.003 | -0.023 | +0.051 | +0.006 |
| C·Tx40·Ty20 | +0.003 | -0.015 | -0.023 | +0.051 | +0.006 |
| C·Tx40·Ty40 | +0.008 | -0.011 | -0.023 | +0.051 | +0.006 |

## 3. ΔSharpe médiane — Max / (pré-2021) — balayage w, seuil=20
| cellule | w5 | w10 | w15 | w20 |
|---|---|---|---|---|
| A·Ty20 | +0.033 (-0.011) | +0.063 (-0.014) | +0.069 (-0.031) | +0.059 (-0.051) |
| B·Tx20 | +0.008 (+0.006) | +0.011 (+0.005) | +0.011 (+0.005) | +0.011 (-0.001) |
| C·Tx20Ty20 | +0.006 (+0.000) | +0.009 (+0.000) | +0.008 (-0.005) | +0.002 (-0.014) |

## 4. Analyse par ÉPISODES (w=10 %, net 25 bps) — décomposition de l'écart de log-perf réel
Écart de log-perf cumulé médian (×100). Robuste = positif APRÈS retrait du meilleur épisode ET de 2021-2022.


### A·Ty20 — 2 épisode(s) : 2003-12→2013-08, 2019-12→2026-06
| épisode | contribution médiane (×100) |
|---|---|
| 2003-12→2013-08 | +0.94 |
| 2019-12→2026-06 | +5.62 |

**A·Ty20** : écart total médian **+5.81** · retrait meilleur épisode (leave-one-episode-out pire) **+0.38** · **retrait 2021-2022 +0.38** · part du meilleur épisode **94 %**

### B·Tx20 — 4 épisode(s) : 1990-09→1990-09, 2000-08→2013-08, 2022-01→2022-12, 2023-09→2023-09
| épisode | contribution médiane (×100) |
|---|---|
| 1990-09→1990-09 | +0.00 |
| 2000-08→2013-08 | +1.49 |
| 2022-01→2022-12 | +1.71 |
| 2023-09→2023-09 | -0.77 |

**B·Tx20** : écart total médian **+2.27** · retrait meilleur épisode (leave-one-episode-out pire) **-0.18** · **retrait 2021-2022 +0.74** · part du meilleur épisode **96 %**

### C·Tx20Ty20 — 3 épisode(s) : 2003-12→2013-08, 2022-01→2022-12, 2023-09→2023-09
| épisode | contribution médiane (×100) |
|---|---|
| 2003-12→2013-08 | +0.00 |
| 2022-01→2022-12 | +1.71 |
| 2023-09→2023-09 | -0.77 |

**C·Tx20Ty20** : écart total médian **+0.95** · retrait meilleur épisode (leave-one-episode-out pire) **-0.88** · **retrait 2021-2022 -0.88** · part du meilleur épisode **170 %**

### A·Ty0 — 2 épisode(s) : 2003-10→2014-02, 2019-08→2026-06
| épisode | contribution médiane (×100) |
|---|---|
| 2003-10→2014-02 | +2.60 |
| 2019-08→2026-06 | +4.41 |

**A·Ty0** : écart total médian **+9.15** · retrait meilleur épisode (leave-one-episode-out pire) **+1.35** · **retrait 2021-2022 +2.42** · part du meilleur épisode **77 %**

### B·Tx0 — 5 épisode(s) : 1990-09→1990-12, 1992-07→1992-09, 2000-02→2013-09, 2021-10→2023-10, 2026-03→2026-04
| épisode | contribution médiane (×100) |
|---|---|
| 1990-09→1990-12 | +0.00 |
| 1992-07→1992-09 | +0.00 |
| 2000-02→2013-09 | +1.75 |
| 2021-10→2023-10 | -1.46 |
| 2026-03→2026-04 | -0.41 |

**B·Tx0** : écart total médian **-0.63** · retrait meilleur épisode (leave-one-episode-out pire) **-2.13** · **retrait 2021-2022 +1.06** · part du meilleur épisode **136 %**
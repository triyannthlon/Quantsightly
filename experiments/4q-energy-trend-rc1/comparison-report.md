# Comparaison normalisée — `4q-standard-v2` · `4q-energy-trend-rc1` · Browne

## Figeage (avant calcul)
- **`4q-standard-v2`** : tag Git `4q-standard-v2` = commit `a067b0c` (bande δ=5, `DEFAULT_MODEL_VERSION=v2`). HEAD courant `345bc0a`.
- **`4q-energy-trend-rc1`** : candidat EXPÉRIMENTAL non commité (spec figée : signal `SPDYENT>SMA6`, poids 10 %, prorata, une bande v2 sur 5 poches). Concordance 28/0 (`concordance-report.md`).
- **Browne** : définition actuelle — 25/25/25/25, rééquilibrage **annuel** (reset au changement d'année civile, même règle pour tous les pays), poids dérivant entre-temps, `MIN_MONTHS=13`. Réplique auto-vérifiée = `computeBrowne`.
- **Formules** : CAGR = `(Vf/Vi)^(12/n)−1` ; vol ann. = σ(rendements mensuels)·√12 ; **Sharpe réel officiel** = `(CAGR réel − CAGR cash réel)/vol réelle` (= Sharpe excédentaire cash réel Quantsightly) ; Sharpe excédentaire arithmétique (secondaire) = `moy(r_réel−rCash_réel)·12/vol` ; turnover = `½·Σ|Δpoids exécutés|` (constitution exclue) ; coûts = `bps·2·turnover` au compounding.
- **Dates/devises/inflation** : fenêtre commune STRICTE par pays (intersection v2/rc1/Browne/inflation/cash) ; devise locale ; CPI local commun ; SPDYENT & or convertis par `convertCurrency` (date exacte).
- **Panel principal** : 21 pays 4Q (DK en sensibilité). Aucun pays retiré selon ses résultats.

⚠️ Le Sharpe officiel Quantsightly EST déjà l'excédent sur le cash réel → le « secondaire » n'en diffère que par la convention arithmétique vs CAGR (montré, non redondant).

## 1. rc1 vs v2 — valeur incrémentale de la poche Énergie (DÉTERMINANT)
Médiane sur 21 pays, réel net, fenêtre commune stricte. Δ = rc1 − v2.

### 25 bps (principal) par horizon
| horizon | ΔSharpe (q1/q3/pire) %imp | ΔCAGR réel %imp | ΔVol | ΔMDD | Δsous-eau | Δpire-12m | Δrotation | Δcoûts cum. | n |
|---|---|---|---|---|---|---|---|---|---|
| Max | +0.128 (+0.111/+0.151/+0.064) 100% | +0.84 100% | -0.29 | -0.0 | +0 | +0.1 | +16.9pt | +1.73 | 21 |
| 20A | +0.111 (+0.088/+0.122/+0.063) 100% | +0.60 100% | -0.40 | -0.0 | +0 | -0.0 | +17.5pt | +1.62 | 21 |
| 10A | +0.183 (+0.157/+0.221/+0.121) 100% | +0.86 100% | -0.67 | +4.2 | -9 | +3.4 | +18.6pt | +0.93 | 21 |
| 5A | +0.243 (+0.191/+0.276/+0.131) 100% | +0.83 100% | -1.07 | +4.1 | -5 | +3.5 | +17.0pt | +0.42 | 21 |

### Sensibilité aux coûts (Max) — ΔSharpe médiane
| 0 bps | 10 bps | 25 bps | 50 bps |
|---|---|---|---|
| +0.142 | +0.136 | +0.128 | +0.117 |

### Contrôles propres à rc1 (Max, 25 bps)
- Poids Énergie moyen **détenu** : médiane **5.8 %** · signal **actif 58 %** des mois
- **Rotation supplémentaire** vs v2 : médiane **+16.9 pt/an** · **contribution nette Énergie** (ΔCAGR réel) : **+0.84 %/an**
- **Hors 2021-2022** : ΔSharpe médiane **+0.063** (%imp 95) · **hors 2007-2008** : **+0.115**
- **Post-lancement SPDYENT (2011-02→)** : ΔSharpe médiane **+0.108** · ΔCAGR **+0.48**

## 2. v2 vs Browne
Médiane 21 pays, réel net 25 bps, fenêtre commune stricte. Δ = v2 − browne.

| horizon | ΔSharpe (q1/q3/pire) %imp | ΔCAGR réel %imp | ΔVol | ΔMDD | Δsous-eau | Δpire-12m | Δrotation | Sharpe v2 / browne | n |
|---|---|---|---|---|---|---|---|---|---|
| Max | -0.005 (-0.063/+0.051/-0.130) 48% | +0.89 90% | +1.41 | -0.0 | +3 | +0.7 | +30.5pt | +0.72/+0.70 | 21 |
| 20A | +0.015 (-0.063/+0.054/-0.129) 57% | +1.14 90% | +1.66 | +0.1 | +3 | +0.9 | +30.0pt | +0.73/+0.73 | 21 |
| 10A | +0.129 (+0.019/+0.203/-0.062) 86% | +2.23 95% | +1.71 | +0.9 | -5 | +2.5 | +28.4pt | +0.93/+0.80 | 21 |
| 5A | +0.216 (+0.087/+0.313/-0.038) 90% | +3.27 100% | +1.64 | +0.3 | -3 | +2.9 | +25.5pt | +1.03/+0.84 | 21 |

## 3. rc1 vs Browne
Médiane 21 pays, réel net 25 bps, fenêtre commune stricte. Δ = rc1 − browne.

| horizon | ΔSharpe (q1/q3/pire) %imp | ΔCAGR réel %imp | ΔVol | ΔMDD | Δsous-eau | Δpire-12m | Δrotation | Sharpe rc1 / browne | n |
|---|---|---|---|---|---|---|---|---|---|
| Max | +0.118 (+0.063/+0.179/-0.051) 90% | +1.79 95% | +1.19 | +0.1 | +0 | +0.8 | +46.3pt | +0.86/+0.70 | 21 |
| 20A | +0.126 (+0.059/+0.144/-0.054) 90% | +1.79 95% | +1.29 | +0.2 | +0 | +1.2 | +46.1pt | +0.85/+0.73 | 21 |
| 10A | +0.296 (+0.198/+0.388/+0.089) 100% | +3.12 100% | +0.99 | +5.0 | -14 | +6.1 | +46.1pt | +1.17/+0.80 | 21 |
| 5A | +0.399 (+0.292/+0.582/+0.161) 100% | +4.07 100% | +0.53 | +3.9 | -10 | +6.7 | +42.2pt | +1.28/+0.84 | 21 |

## Sensibilité — panel + Danemark
| paire (Max, 25 bps) | ΔSharpe 21 pays | ΔSharpe 21+DK |
|---|---|---|
| rc1−v2 | +0.128 | +0.130 |
| v2−Browne | -0.005 | +0.001 |
| rc1−Browne | +0.118 | +0.122 |

## Niveaux absolus par modèle (Max, 25 bps, médiane 21 pays, fenêtre commune)
| modèle | CAGR nom | CAGR réel | Vol réelle | Sharpe réel | MDD réel | sous-eau | pire 12m | pire 5A | pire 10A | pire 15A | rotation | fréq/an | coûts cum. |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **v2** | 7.56 | 5.35 | 7.88 | 0.718 | -14.0 | 55 | -11.6 | -0.7 | 1.5 | 3.1 | 34.4% | 4.2 | 3.7 |
| **rc1** | 8.53 | 6.13 | 7.47 | 0.864 | -13.9 | 52 | -11.7 | -0.2 | 2.3 | 3.8 | 50.3% | 5.3 | 5.6 |
| **Browne** | 6.61 | 4.42 | 6.33 | 0.701 | -14.9 | 47 | -11.5 | 0.2 | 1.6 | 2.6 | 4.3% | 1.0 | 0.5 |

→ **Sharpe secondaire (excédent arithmétique)** ≈ officiel (écart médian 0.013) — même conclusion, non redondant.

## Matrice de décision
| paire (Max, 25 bps) | ΔSharpe méd | %amél. | pire-décile | ΔSharpe hors 21-22 | verdict |
|---|---|---|---|---|---|
| **rc1 vs v2** (déterminant) | +0.128 | 100% | +0.064 | +0.063 | ✅ gain robuste |
| v2 vs Browne | -0.005 | 48% | -0.130 | -0.033 | ⚖️ ~égalité |
| rc1 vs Browne | +0.118 | 90% | -0.051 | +0.030 | 🟡 gain non robuste |

**Lecture (point de surveillance de Yann)** : `rc1 vs v2` est le juge de paix. Ici l'avantage de rc1 sur le modèle DE PRODUCTION v2 est **robuste** (ΔSharpe +0,128 Max, 100 % pays, pire-décile positif, **positif hors 2021-2022** +0,063, vol en baisse, robuste aux coûts) — pas faible ni fragile. Réserves maintenues : le gain hors-2021-2022 est **modeste** (+0,063 vs +0,128), la **rotation augmente** (+17 pt/an), et la validation reste **in-sample** (même historique que la découverte). `v2 vs Browne` ≈ égalité sur le long terme (v2 devant en récent) ; `rc1 vs Browne` = rc1 devant.

**Aucune intégration automatique.** Décision d'intégration = ultérieure, humaine. rc1 reste candidat expérimental figé ; production `4q-standard-v2` inchangée.
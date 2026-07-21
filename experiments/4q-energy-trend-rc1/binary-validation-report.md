# Validation BINAIRE — `4q-energy-trend-rc1`

Déterminant marginal : **4Q Binaire v2 + Énergie** vs **4Q Binaire v2** (sans Énergie). Spec rc1 FIGÉE (SMA6, w=10 %, prorata, t→t+1, une bande sur 5 poches). 21 pays, réel net, fenêtre commune des deux bras. Δ = Binaire+Énergie − Binaire.

## Par horizon (25 bps)
| horizon | ΔSharpe (q1/q3/pire) %imp | ΔCAGR réel %imp | ΔVol | ΔMDD | rotation sup. | coûts cum. sup. | n |
|---|---|---|---|---|---|---|---|
| Max | +0.112 (+0.091/+0.128/+0.052) 100% | +0.76 100% | -0.41 | -0.1 | +15.9pt | +1.67 | 21 |
| 20A | +0.079 (+0.066/+0.098/+0.041) 100% | +0.56 100% | -0.43 | -0.1 | +17.2pt | +1.54 | 21 |
| 10A | +0.178 (+0.151/+0.203/+0.102) 100% | +0.95 100% | -0.64 | +4.1 | +16.3pt | +0.81 | 21 |
| 5A | +0.201 (+0.181/+0.237/+0.082) 100% | +0.86 100% | -1.20 | +4.1 | +18.0pt | +0.44 | 21 |

## Sensibilité aux coûts (Max) — ΔSharpe médiane
| 0 bps | 10 bps | 25 bps | 50 bps |
|---|---|---|---|
| +0.123 | +0.119 | +0.112 | +0.100 |

## Contrôles temporels (Max, 25 bps) — médiane ΔSharpe
- **Hors 2021-2022** : +0.057 (%imp 95, pire-décile +0.000)
- **Hors 2007-2008** : +0.100 (%imp 100)
- **Post-lancement SPDYENT (2011-02→)** : +0.084 (%imp 100)
- Poids Énergie moyen **détenu** 6.0 % · signal actif 58 % · **rotation sup.** +15.9 pt/an · **contribution nette** (ΔCAGR) +0.76 %/an

## Sensibilité — panel + Danemark (Max, 25 bps)
- 21 pays : ΔSharpe +0.112 · 21+DK : +0.113

## Verdict Binaire
| critère | valeur | seuil | ok |
|---|---|---|---|
| ΔSharpe Max | +0.112 | > +0,02 | ✅ |
| % pays améliorés | 100% | ≥ 90 % | ✅ |
| pire-décile | +0.052 | ≥ 0 | ✅ |
| hors 2021-2022 | +0.057 | ≥ 0 | ✅ |

**✅ L'Énergie améliore ROBUSTEMENT la Binaire** → la surcouche peut devenir une composante COMMUNE (Dynamique + Binaire).

⚠️ Rappel : un résultat Binaire faible n'invalide PAS le résultat Dynamique (bases d'allocation différentes). rc1 FIGÉ (L6/w10/prorata). Aucune réoptimisation. `4q-standard-v2` reste la version publique et le rollback. Aucune modif moteur/interface.
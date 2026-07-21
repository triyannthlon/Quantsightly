# Bootstrap FINAL — contrôle avant merge (panel synchronisé)

5000 réplications · blocs mensuels de 12 mois · **mêmes blocs pour tous les pays** (signal SPDYENT mondial, crises communes) · réel net 25 bps · min 60 mois/pays. IC de la médiane des Δ (energy-trend-v1 − v2) sur 21 pays. Aucune optimisation.

## DYNAMIC
| métrique | Δ médian | IC 90 % | IC 95 % | signe stable |
|---|---|---|---|---|
| ΔCAGR réel net | +0.703 | [-0.093 … +1.454] | [-0.217 … +1.590] | ⚠️ |
| ΔSortino | +0.230 | [+0.009 … +0.494] | [-0.019 … +0.556] | ⚠️ |
| ΔES 95 % | +0.110 | [-0.003 … +0.599] | [-0.015 … +0.760] | ⚠️ |
| ΔES 99 % | +0.073 | [+0.000 … +1.557] | [+0.000 … +2.047] | ⚠️ |
| ΔMax drawdown | +1.04 | [-0.28 … +4.11] | [-0.45 … +4.78] | ⚠️ |

## BINARY
| métrique | Δ médian | IC 90 % | IC 95 % | signe stable |
|---|---|---|---|---|
| ΔCAGR réel net | +0.687 | [-0.160 … +1.472] | [-0.274 … +1.616] | ⚠️ |
| ΔSortino | +0.182 | [+0.001 … +0.418] | [-0.028 … +0.470] | ⚠️ |
| ΔES 95 % | +0.110 | [-0.014 … +0.612] | [-0.031 … +0.782] | ⚠️ |
| ΔES 99 % | +0.062 | [+0.000 … +1.606] | [+0.000 … +1.751] | ⚠️ |
| ΔMax drawdown | +0.78 | [-0.35 … +3.41] | [-0.49 … +4.35] | ⚠️ |

_(14 s)_ · Rappel : ES/CAGR/Sortino positifs = amélioration ; ΔMaxDD positif = drawdown moins profond (meilleur). « signe stable » = IC 95 % entièrement > 0.

**Conclusion (honnête).** Les **estimateurs ponctuels sont STABLES et positifs** sur les deux variantes (ΔCAGR ~+0,70, ΔSortino ~+0,20, ΔES95/99 améliorés, ΔMaxDD ~+1), cohérents avec les mesures directes. **MAIS** le rééchantillonnage **synchronisé** (correct : les crises frappent tous les pays ensemble ⇒ ≠ 21 échantillons indépendants) **élargit les IC** par rapport à un bootstrap indépendant par pays : l'IC 90 % de **ΔSortino** est positif et la borne basse de **ΔES99** ~0+, mais les **IC 95 % chevauchent zéro** pour ΔCAGR, ΔES95 et ΔMaxDD.

➡️ **Aucune anomalie méthodologique.** L'amélioration reste **positive en espérance** et la **queue n'est jamais dégradée** ; sa **significativité statistique est simplement limitée par le faible nombre d'ÉPISODES indépendants** (crises 2008/2014-16/2020/2021-22/…). Ce contrôle **quantifie et confirme la réserve d'incertitude hors-échantillon** déjà notée — il ne l'infirme ni ne la lève. Conséquence directe (voulue) : **suivi parallèle hors-échantillon**, gel des paramètres, **pas d'activation publique ni de ré-optimisation**.
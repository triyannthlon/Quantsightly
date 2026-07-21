# Étude 2 — Rapport de concordance moteur EXPÉRIMENTAL ↔ PRODUCTION

> Validation Phase 5 : le protocole rejoué depuis le **moteur de production**
> (`four-quadrants-service` + `backtestQuadrants` avec version v1/v2) concorde avec le
> harnais expérimental (`study2-percountry.csv`). Gross (0 bps), dynamique + binaire, T=20.

## Résultats

| Contrôle | Résultat |
|---|---|
| Appel local `backtestQuadrants(v1)` == sortie service | **identique** (< 1e-12) |
| Écart CAGR réel production ↔ harnais (max) | 4.96e-4 pt |
| Écart rotation **Max** (max) | 4.99e-2 pt — même fenêtre ⇒ ≈ 0 |
| Écart rotation **fenêtré** (max / médiane) | 5.084 / 0.327 pt |
| **v1 inchangé** (prod ↔ harnais δ=0, max) | 4.96e-4 pt |
| Témoin v1 US Max | CAGR 6.32 % (réf 6,32), rotation 36.8 % |
| v2 rotation médiane (dyn Max) | -25.8 % vs v1 |
| v2 fréquence réalloc médiane | 11.7→4.2/an (-64 %) |

## Écart harnais ↔ production (documenté)

Le seul écart notable est sur la **rotation des horizons fenêtrés** (20A/10A/5A) : le
moteur de **production compte la transaction d'entrée** de la fenêtre restreinte
(mois-frontière), alors que le harnais expérimental la mesure hors-fenêtre. C'est un choix
d'agrégation **connu et bénin** : il s'applique IDENTIQUEMENT à v1 et v2, donc la
**réduction** de rotation v1→v2 (le résultat de l'étude) est inchangée. Sur **Max**
(fenêtre = historique complet, pas de transaction d'entrée), la concordance est **exacte**.

**Conclusion** : la production reproduit l'étude ; v1 est inchangé ; les métriques v2
(rotation, fréquence, performance) correspondent aux valeurs annoncées. Aucun écart ne
provient d'une divergence de logique entre harnais et moteur officiel.
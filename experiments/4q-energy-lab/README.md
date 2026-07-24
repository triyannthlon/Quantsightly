# Laboratoire Énergie — expériences (LECTURE SEULE)

Scripts d'analyse hors-produit pour la surcouche `energy-trend-v1` (comparée au socle
`4q-standard-v2`). **Aucun** de ces scripts ne modifie le moteur, les formules, les poids, la
règle d'activation, le financement, les fixtures, les goldens, les flags ni l'application. Ils
lisent la base et écrivent uniquement sous `experiments/4q-energy-lab/`.

## Scripts

| Script                  | Rôle                                                              | Écrit                                       |
| ----------------------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `non-leak.mts`          | Non-fuite : `QS_ENERGY_OVERLAY` n'affecte pas les pages publiques | rien                                        |
| `lab-concordance.mts`   | Concordance du service labo vs fixtures de production             | `__fixtures__/lab-signatures.json` (golden) |
| `lab-subperiod.mts`     | Vérifie le paramètre `windowYears` (sous-périodes)                | rien                                        |
| `robustness-matrix.mts` | **Export batch de robustesse** (cette étude)                      | `output/`                                   |

## `robustness-matrix.mts` — export de robustesse

Compare `4q-standard-v2` vs `4q-standard-v2 + energy-trend-v1` sur une **fenêtre strictement
commune** (écart = variante Énergie − socle **recalculé sur exactement les mêmes dates**, jamais
full-history vs sous-fenêtré). N'exploite que `computeEnergyLabComparison(country, strategy,
version, windowYears)` + les helpers d'affichage déjà validés (`lab-window-metrics`, `lab-crises`).

Matrice : 22 pays × {dynamic, binary} × {commun, 20 ans, 10 ans, 5 ans} × {nominal, réel}.

### Exécution

```bash
pnpm exec tsx experiments/4q-energy-lab/robustness-matrix.mts
# essai rapide (sous-ensemble) :
LAB_SUBSET="US,JP" pnpm exec tsx experiments/4q-energy-lab/robustness-matrix.mts
# régénérer l'instantané en conservant la référence au commit modèle :
LAB_SOURCE_COMMIT=50047d5 pnpm exec tsx experiments/4q-energy-lab/robustness-matrix.mts
```

### Sorties (`output/`)

- `metrics.csv` — 1 ligne / pays × stratégie × période × mode ; triplets socle/énergie/écart pour
  9 métriques + `delta_annualized_net_{10,25,50}bps`.
- `signal-and-turnover.csv` — 1 ligne / pays × stratégie × période (indépendant du mode) ;
  rotation, contribution Énergie (nominale), stats de signal filtrées à la fenêtre.
- `crises.csv` — 1 ligne / pays × stratégie × période × mode × crise (crises **entièrement
  couvertes**, non provisoires).
- `summary.csv` — synthèse / stratégie × période × mode (médiane, quartiles, min, max des écarts ;
  proportions favorables). **Danemark et fenêtres < 60 mois exclus des agrégats.**
- `robustness-data.json` — dataset structuré complet (nulls préservés).
- `manifest.json` — traçabilité (`sourceGitCommit`, versions, conventions de rotation et de coûts,
  exclusions statistiques, comptes de lignes, avertissements). **Non inclus dans `CHECKSUMS.sha256`**
  car il contient `generatedAt` (horodatage non reproductible).
- `CHECKSUMS.sha256` — empreintes SHA-256 des 5 fichiers de données figés.

### Conventions

- **Rotation** : unidirectionnelle (½·Σ|Δw|), annualisée sur la fenêtre (mois de départ = constitution,
  exclu). Un rééquilibrage = achat + vente ⇒ volume = 2 × rotation.
- **Coûts (post-traitement)** : jamais injectés dans le backtest. Coût annuel = 2 × rotation × bps/10000 ;
  `Δnet = Δperf% − 2·Δturnover·(bps/10000)·100`. Approximation annualisée ; un net **mensuel** série par
  série est produit par l'audit (`audit-net-costs.mts`).
- **Fenêtre commune** : le signal, les allocations et les rééquilibrages sont toujours calculés sur
  tout l'historique (chauffe préservée) ; seule l'évaluation est restreinte à la sous-période, rebasée
  à 100 à son début.

### Réserve statistique

Les pays et les horizons ne sont **pas indépendants** (marchés corrélés ; fenêtres emboîtées
5a ⊂ 10a ⊂ 20a ⊂ commun). Cet export ne produit **aucun score composite ni décision produit** : il
fournit un jeu de données auditable et reproductible.

### Déterminisme & reproductibilité

Itération triée, aucun `Date.now()`/aléatoire hors `manifest.generatedAt`. Deux exécutions
consécutives produisent des fichiers de données **byte-identiques** (vérifiable via `CHECKSUMS.sha256`).

### Régénération de `robustness-data.json`

Si `robustness-data.json` devenait trop volumineux pour Git (> 10 Mo), il serait retiré du dépôt
(ajouté au `.gitignore` local) et régénéré par la commande d'exécution ci-dessus ; les CSV et le
manifeste restent la source figée. (Taille actuelle : ~1,3 Mo ⇒ conservé.)

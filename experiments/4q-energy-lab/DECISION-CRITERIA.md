# Critères de lecture — surcouche `energy-trend-v1` (PRÉ-ENREGISTRÉS)

**Pré-enregistrés AVANT toute nouvelle conclusion**, pour éviter de choisir les seuils après avoir
vu les résultats. Instantané source : `sourceGitCommit: 50047d5` (`4q-standard-v2` vs
`4q-standard-v2 + energy-trend-v1`). Aucune décision produit n'est prise dans ce fichier : il fixe
la grille de lecture. La métrique principale s'appuie sur le **net de coûts MENSUEL** (audit B),
pas sur l'approximation annualisée de l'export.

## Métrique principale

**Δ Sharpe net après 25 pb** (variante Énergie − socle, mêmes dates, coûts appliqués mensuellement).

## Métriques secondaires

- Δ performance annualisée nette ;
- Δ Calmar net ;
- Δ max drawdown net ;
- supplément de rotation (Δ rotation annualisée) ;
- stabilité hors grands épisodes énergétiques (notamment hors 2021–2022).

## Bandes par cellule (pays × stratégie × période × mode)

**Δ Sharpe net (25 pb)**

- favorable : `≥ +0,05`
- neutre : `> −0,05` et `< +0,05`
- défavorable : `≤ −0,05`

**Δ rendement annualisé net**

- favorable : `≥ +0,25 point/an`
- neutre : entre `−0,25` et `+0,25 point`
- défavorable : `≤ −0,25 point/an`

## Seuil « candidat bêta publique »

Toutes les conditions requises :

1. Δ Sharpe net à 25 pb **favorable dans ≥ 75 %** des pays exploitables ;
2. résultat **positif pour les deux stratégies** (`dynamic` et `binary`) ;
3. résultat **positif sur l'historique commun ET sur 10 ans** ;
4. **médiane transversale** du Δ Sharpe net **≥ +0,10** ;
5. **médiane** du Δ rendement net **positive à 50 pb** ;
6. **aucune détérioration extrême** du max drawdown **> 5 points** ;
7. amélioration **encore positive hors 2021–2022**.

## Seuil « option de production »

En plus de **toutes** les conditions de bêta :

1. robustesse sur **plusieurs sous-périodes NON emboîtées** ;
2. amélioration **hors grandes crises énergétiques** ;
3. **intervalles de confiance bootstrap à 95 % ne chevauchant plus zéro** pour la métrique principale ;
4. comportement **satisfaisant après 50 pb** de coûts ;
5. **absence de dépendance à un nombre très réduit de pays**.

## Statut maximal autorisé

Tant que le dernier groupe de conditions (« option de production ») n'est **pas** intégralement
satisfait, le statut maximal autorisé reste :

> **bêta publique avancée, activable volontairement.**

## Traitement des dépendances (rappel méthodologique)

Pays et horizons **non indépendants** (marchés corrélés ; fenêtres emboîtées 5a ⊂ 10a ⊂ 20a ⊂
commun). Les proportions et médianes transversales sont **descriptives**, pas des tests
d'indépendance. Le franchissement du seuil production exige explicitement des **sous-périodes non
emboîtées** et un **bootstrap** tenant compte de ces dépendances (blocs, panel synchronisé).

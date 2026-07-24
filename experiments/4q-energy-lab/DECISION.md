# Décision — surcouche `energy-trend-v1` (2026-07-24)

**Décision produit : CONSERVER `energy-trend-v1` comme surcouche FACULTATIVE**, distincte de
`4q-standard-v2` — qui **demeure le modèle public de référence à quatre poches, inchangé**.

## Fondement

- Instantané de robustesse figé (`sourceGitCommit: 50047d5`, commit `02fe640`) + audit méthodologique
  indépendant (commit d'outillage associé) :
  - reconstruction indépendante **940/0** conforme → pas d'anomalie de calcul (mêmes dates/base,
    cash du Sharpe = fenêtre, sous-fenêtrage préservant l'état, pas de look-ahead évident) ;
  - métriques **nettes de coûts** recalculées mensuellement (10/25/50 pb) → apport **suffisamment
    régulier après coûts** (Δ Sharpe net positif dans toutes les cellules exploitables, y compris
    à 50 pb ; Δ rendement net médian positif).
- L'amélioration du drawdown net n'est pas universelle sur les très longues fenêtres, mais l'apport
  rendement/risque après coûts est jugé suffisant pour conserver la surcouche.

## Mise en production (2026-07-24)

L'**onglet Énergie devient une fonctionnalité publique autonome** : sa visibilité et sa route ne
dépendent plus d'aucune variable d'environnement. Le flag de gate historique a été **entièrement
supprimé** (code, tests, documentation), sans flag de remplacement.

## Portée exacte de la décision

- L'onglet Énergie est **toujours visible** et sa route **toujours accessible**, sans variable
  d'environnement.
- Les pages publiques autres que l'onglet Énergie restent `4q-standard-v2` (`overlay:"off"`
  explicite). La surcouche Énergie est une exposition **optionnelle et distincte**, jamais un
  cinquième pilier permanent du modèle public.
- Le modèle standard reste strictement à **quatre poches** (Actions, Obligations, Or, Liquidités) ;
  la 5ᵉ poche `energy` n'apparaît QUE dans la comparaison de l'onglet Énergie.
- **Rien du modèle n'a été modifié** : ni formule, ni poids, ni règle d'activation, ni financement
  au prorata, ni golden, ni fixture. Aucune ré-optimisation.

## Ce que cette décision n'est PAS

- Ce n'est **pas** un changement du portefeuille 4 Quadrants de référence : la surcouche n'est pas
  appliquée au modèle standard des autres pages, elle reste une comparaison propre à l'onglet Énergie.
- Ce n'est pas une validation de robustesse hors-échantillon de niveau « production » au sens du
  bootstrap : le bootstrap OOS n'a pas été relancé (cf. `DECISION-CRITERIA.md`). Cela n'empêche pas la
  mise à disposition publique de l'onglet de comparaison, qui ne modifie pas le modèle de référence.

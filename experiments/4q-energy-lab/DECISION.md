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

## Portée exacte de la décision

- `energy-trend-v1` reste **intégré mais dormant** : **aucune activation par défaut**, gate UI interne
  inchangée (`QS_ENERGY_LAB_ENABLED` off par défaut), sélection de variante inchangée
  (`QS_ENERGY_OVERLAY` off par défaut).
- Les pages publiques restent `4q-standard-v2` (`overlay:"off"` explicite). La surcouche Énergie est
  une exposition **optionnelle et distincte**, jamais un cinquième pilier permanent du modèle public.
- **Rien n'a été modifié** : ni formule, ni poids, ni règle d'activation, ni financement au prorata,
  ni golden, ni fixture, ni flag, ni interface. Cette décision est un choix de **conservation**, pas
  une mise en production publique ni une ré-optimisation.

## Ce que cette décision n'est PAS

- Ce n'est pas une activation publique par défaut.
- Ce n'est pas une validation de robustesse hors-échantillon de niveau « production » : le bootstrap
  OOS n'a pas été relancé dans cette étude (cf. `DECISION-CRITERIA.md`, seuil production non traité).
  Toute évolution vers une activation publique resterait subordonnée à ce palier.

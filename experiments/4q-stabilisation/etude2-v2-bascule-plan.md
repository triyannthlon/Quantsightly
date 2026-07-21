# Plan de fusion & de bascule — `4q-standard-v2` (décision Go/No-Go)

> Le candidat **`4q-standard-v2-rc2`** est figé et **validé** (moteur + recette visuelle complète,
> cf. `etude2-recette-v2.md`). Ce document décrit les **deux décisions séparées** qui restent, avec
> leurs effets, non-régressions et rollbacks. **Rien n'est exécuté sans l'accord de Yann.**
> Production **actuelle = v1** (`DEFAULT_MODEL_VERSION = "v1"`, aucun flag).

## Principe : deux décisions distinctes

| | Décision A — **Fusionner dans `main`** | Décision B — **Basculer la production en v2** |
|---|---|---|
| Ce que ça fait | Amène le moteur v2 + le flag de staging dans la mainline | Fait de v2 le **socle affiché** aux utilisateurs |
| Effet sur la production | **AUCUN** (défaut reste v1 ; v2 est opt-in par flag) | Change les chiffres & textes affichés (v2) |
| Réversibilité | `git revert` du merge | Repasser `DEFAULT_MODEL_VERSION="v1"` |
| Risque | Très faible (comportement inchangé) | Modéré (chiffres/pédagogie changent) |

⇒ **A peut être fait sans B.** Fusionner sécurise le travail dans `main` **sans** toucher au rendu
utilisateur. La bascule (B) est un second Go explicite.

## Décision A — Fusion `4q-standard-v2-band5` → `main`

**Contenu de la branche** (au-dessus de `main`) : moteur bande (v1 intact), tests + golden v2
distinct, service threadé `version` (défaut v1), câblage staging (flag, défaut v1), correctifs UI
gatés `IS_MODEL_V2`, docs d'étude. **`main` déjà présent dans l'historique de la branche** (elle en
part) : energy `9690e35`, archive étude 2 `f4d9fad`.

- **Stratégie recommandée** : **merge `--no-ff`** (garde les jalons `rc1`/`rc2` et l'historique
  d'étude). Alternative : squash en un commit « 4 Quadrants : socle v2 (bande δ=5) » si tu préfères
  un `main` plat — mais on perd la traçabilité des jalons.
- **Vérifs avant merge** : `pnpm tsc --noEmit` · `pnpm eslint` · `pnpm build` · `pnpm test:run`
  (golden v1 **inchangé** = garde-fou). Confirmer `git diff main..HEAD -- src/` ne change aucun
  comportement par défaut (v1).
- **Après merge** : `main` contient v2 **mais la production reste v1** (défaut). Push `main`.
- **Rollback** : `git revert -m 1 <merge>` (ou reset si non poussé).

## Décision B — Bascule production v2 (second Go, séparé)

### Comment (choix d'implémentation, à trancher)
1. **Global** — passer `DEFAULT_MODEL_VERSION` de `"v1"` à `"v2"` dans `model-version.ts` (un seul
   point). Simple, mais bascule **toutes** les surfaces 4Q d'un coup.
2. **Par page (recommandé, plus réversible)** — passer explicitement `version:"v2"` dans les loaders
   des pages 4Q (`page.tsx`, `actions.ts`) et `ACTIVE_REALLOCATION_BAND` côté client, en gardant le
   défaut global v1. Permet une bascule progressive et un rollback page par page.

### Effets attendus (déjà validés en recette)
- Chiffres : **rotation plus basse** (~−26 %), fréquence de réallocation ~÷3, perf réelle ≈ ou
  légèrement mieux **nette de coûts** ; drawdown ≈ inchangé.
- UI : Composition = poids **détenus** + bloc « Détenue/Cible » en état conservé ; Méthodologie =
  texte « réallocation conditionnelle » (déjà gaté `IS_MODEL_V2`) ; **la bannière de staging
  DISPARAÎT automatiquement** (elle ne s'affiche que si v2 ≠ défaut).
- Confidentialité : **seuil/formule jamais exposés** (inchangé).

### Non-régression à relancer APRÈS bascule
- Recette **data-level** des 4 vues en v2 (comme pour v1) : régime/allocation-cible inchangés, seuls
  rotation/perf bougent dans le sens attendu.
- Vérifier qu'aucune fixture/golden **applicatif** (hors moteur) n'était figée sur des chiffres v1.
- Nouveau **jalon `4q-standard-v2`** (tag) une fois la bascule stable ; **conserver v1** (le code
  reste, `version:"v1"` rejouable) pour comparaison/rollback un temps.

### Rollback B
Repasser le défaut / les loaders à `v1` → retour immédiat au comportement historique (le code v1
n'est jamais supprimé).

## Séquencement proposé

1. **[Go A ?]** Fusionner la branche dans `main` (prod reste v1). ← *décision immédiate possible*
2. **[Go B ?]** Choisir l'implémentation de bascule (global vs par page), l'appliquer sur une
   surface, re-valider, puis étendre.
3. Tag `4q-standard-v2`, conserver v1 pour rollback.
4. **Puis seulement** : reprise des chantiers gelés — **vitesse/accélération**, **comparaison
   Browne** (aucun avant la bascule stabilisée, consigne Yann).

## Exécution — décision B PRÉPARÉE (2026-07-21)

Après validation de A (déploiement `main` v1 + smoke test prod conformes, Yann), **B est préparée**
(commit sur `main`, **pas encore déployée, pas de tag**) :
- **Bascule GLOBALE** : `DEFAULT_MODEL_VERSION` passé à `"v2"` (`model-version.ts`) — une seule
  constante, propagée à **toutes** les surfaces (service : défaut des 4 fonctions ; client :
  `ACTIVE_*` ; contenu : `IS_MODEL_V2`). **Pas de bascule page par page.**
- **Retour v1 simple conservé** : (a) repasser la constante à `"v1"` (build+déploiement) **ou**
  (b) déployer avec l'env **`NEXT_PUBLIC_QS_MODEL_VERSION=v1`** (aucun code à changer — le flag
  accepte désormais `v1`|`v2`). Code v1 jamais supprimé.
- **Bannière de staging** : disparaît automatiquement (`IS_STAGING_V2 = IS_MODEL_V2 && DÉFAUT≠"v2"`
  → faux quand le défaut est v2). ✅
- **Contrôles data-level** (`bascule-check.mts`) : service défaut = **v2** (US rotation 24,2 %,
  CAGR 6,35 %) · retour `v1` OK (36,8 % / 6,32 %) · GB détenu≠cible. `tsc`/`lint`/**212 tests**
  (golden v1 **et** v2 inchangés)/`build` **verts**.
- **À faire par Yann** : déployer ce `main` (défaut v2) + recette prod (smoke 4 pages, détenu/cible,
  rotation/fréquence, Binaire/Dynamique, indisponibilités/périodes, console/erreurs serveur,
  comparaison fixtures `v2-rc2`, bannière absente). **Tag `4q-standard-v2` créé APRÈS** cette
  validation prod **sans rollback**, pointant le commit déployé.

## Points ouverts pour Yann
- **A** : merge `--no-ff` (jalons conservés) **ou** squash (`main` plat) ?
- **B** : bascule **globale** (défaut v2) **ou** **par page** (recommandé) ?
- Quand créer le tag `4q-standard-v2` : à la fusion (A) ou seulement après bascule (B) ?
- Communication produit : quel libellé public pour le bénéfice (« portefeuille plus stable / moins
  d'opérations »), **sans** révéler le seuil ?

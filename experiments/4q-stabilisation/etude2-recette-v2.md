# Recette v2-rc1 — rapport & recommandation Go / No-Go

> Recette du candidat `4q-standard-v2` (bande δ=5) sur les pages 4Q, **en staging**
> (`NEXT_PUBLIC_QS_MODEL_VERSION=v2`), **production inchangée (v1)**. Aucun merge, aucune
> migration, aucune suppression de v1.

## 0. Câblage de staging (réversible, défaut v1)

- `model-version-active.ts` : lit `NEXT_PUBLIC_QS_MODEL_VERSION` (**absent ⇒ v1**). Source
  UNIQUE partagée par le recalcul **client** (`quadrants-view`) ET les actions **serveur**
  (comparaison / multi-pays) ⇒ impossible de mélanger v1/v2 dans une vue.
- **Bannière interne** amber « Recette interne · moteur 4q-standard-v2-rc1 actif » (sans le seuil).
- **Aucun sélecteur v1/v2 utilisateur.** Le seuil/formule ne sont exposés nulle part.
- **Lancer la recette** : `NEXT_PUBLIC_QS_MODEL_VERSION=v2 pnpm dev` → se connecter → `/modeles/quadrants`.

## 1. Points de contrôle (1–8)

| # | Point | Verdict | Détail |
|---|---|---|---|
| 3 | Même version partout (graphes/tableaux/indicateurs) | ✅ | Seul `quadrants-view` appelle le moteur client (via le flag) ; tout le reste passe par les actions serveur (flag). |
| 4 | Aucun mélange v1/v2 silencieux | ✅ | Source unique `ACTIVE_MODEL_VERSION` ; vérifié : aucun autre `backtestQuadrants`/`buildModel` dans les composants 4Q. |
| 5 | Rotation & fréquence = concordance | ✅ | US 36,8→24,2 %, fréq 11,6→3,4/an ; FR 43,9→32,4 % ; IN 47,8→36,0 % ; CN 39,8→27,3 % (= rapport de concordance). |
| 6 | Périodes / indispo / nominal-réel corrects | ✅ | **Fenêtre effective IDENTIQUE v1 vs v2** (mêmes start/end/mois) ; garde-fous d'indisponibilité **avant** la bande (inchangés) ; modes nominal/réel intacts. |
| 7 | Seuil/formule non exposés publiquement | ✅ (donnée) / ⚠️ (texte) | Le seuil δ n'apparaît nulle part. **Mais** la Méthodologie décrit v1 et **nie** tout seuil (cf. §3). |
| 8 | Aucune régression responsive/visuelle | ✅ *(attendu)* | Diff = bannière + bloc secondaire conditionnel + valeurs (rotation/perf) qui baissent ; aucun changement de structure. *(Confirmation visuelle à faire, cf. §5.)* |
| 1 | Allocation affichée = poids **détenus**, pas systématiquement la cible | ✅ **CORRIGÉ** | La Composition affiche désormais `bt.heldAllocation` (poids détenus). Cf. §7. |
| 2 | Un mouvement bloqué par la bande ≠ réallocation affichée | ✅ **CORRIGÉ** | Bloc secondaire « détenu vs cible » + statut « Aucune réallocation ce mois-ci » quand ils divergent. Cf. §7. |

## 2. Divergence affichage ↔ moteur (la seule bloquante)

**Carte « Composition du portefeuille » = CIBLE, pas poids DÉTENUS.** Mesuré sur les 22 pays
(dernier mois, v2) : pour **21/22** le dernier mois est une réallocation → détenu = cible → OK.
Pour **GB (Royaume-Uni)**, la dernière réallocation est **bloquée par la bande** :

| | Actions | Oblig | Or | Cash | écart |
|---|---|---|---|---|---|
| Cible affichée (`latest.finalAllocation`) | 34 % | 6 % | 44 % | 16 % | — |
| **Détenu réel v2** | 40 % | 2 % | 48 % | 10 % | **9,2 %** |

C'est **ponctuel aujourd'hui (1/22)** mais **structurel** : tout pays est périodiquement en état
« bande active », et la carte deviendrait alors trompeuse. **La rotation et les Sources de
performance sont, elles, déjà v2-correctes** (calculées sur les poids détenus dans le backtest) —
seule la **Composition** lit la cible du modèle.

**Correctif requis (migration, pas dans la recette)** : exposer les **poids détenus courants**
depuis le backtest (le chemin `held` existe déjà en interne) et les afficher dans « Composition »
sous v2 — idéalement **Détenu** vs **Cible** (pédagogique : « on ne réalloue que si l'écart est
significatif »), sans révéler le seuil.

## 3. Textes à adapter (Méthodologie — sans révéler δ)

La Méthodologie est **statique** et décrit **v1** ; sous v2 elle est incohérente :
1. Section **« Réallocation mensuelle sans anticipation »** (« le portefeuille est ensuite réalloué
   des poids détenus vers les nouveaux poids cibles » chaque mois) → à nuancer : réallocation
   **conditionnelle** (seulement si l'écart à la cible est significatif).
2. Hypothèse **« Réallocation mensuelle »** : *« Le portefeuille est intégralement ramené vers cette
   cible chaque mois. Il n'existe pas de seuil de non-intervention supplémentaire. »* → **FAUX sous
   v2** (il existe justement une bande). À réécrire pour décrire le **principe** (« on ne réalloue
   que lorsque l'écart aux cibles dépasse un seuil de significativité ») **sans chiffrer δ**.
3. Encart hypothèses (« réallocations mensuelles simulées sans frais ») : préciser que les coûts
   restent une hypothèse externe (inchangé) ; le bénéfice v2 = **moins de réallocations**.

Le label « Rotation annualisée · X %/an » et sa définition restent corrects (la valeur est v2).

## 4. Tests automatisés après raccordement

- `pnpm tsc --noEmit` : **OK**. `pnpm eslint` (fichiers touchés) : **OK**. `pnpm build` : **OK**
  (build sans flag ⇒ v1, production inchangée).
- **Vitest : 209 tests verts** (dont v1 `standard-v1` inchangé, `band.test` ×10, `standard-v2` golden).
- Recette data-level (`recette-data.mts`) : métriques v2 = concordance, fenêtres identiques.

## 5. Captures — limite d'accès

Les pages `(admin)` sont derrière **auth OTP** (code vérifié par le backend C++), et le middleware
exige une **session en base** : je **ne peux pas** capturer les pages en automatique **sans le code
OTP de Yann** (et je n'ai ni bypassé l'auth ni écrit en base). **À faire par Yann** :
`NEXT_PUBLIC_QS_MODEL_VERSION=v2 pnpm dev` → login → `/modeles/quadrants` (bannière amber visible) →
vérifier visuellement les 4 onglets + responsive. La recette **data-level + code** ci-dessus couvre
les points 1–7 de façon déterministe ; seul le point 8 (visuel/responsive) reste à confirmer à l'œil.

## 6. Recommandation — **candidat `4q-standard-v2-rc2` VALIDÉ** (recette complète OK)

Le **moteur v2 est validé et correct**, les métriques s'affichent juste, les correctifs bloquants
sont appliqués (§7), les ajustements desktop sont faits (§9), et la **recette visuelle complète est
validée** (§10). ⇒ Le candidat est figé en **`4q-standard-v2-rc2`**.

⚠️ **La BASCULE de production reste une décision séparée** (Go/No-Go) : le candidat est prêt, mais
la production **reste en v1** tant que Yann n'a pas validé le **plan de fusion et de bascule**
(`etude2-v2-bascule-plan.md`). Aucun merge, aucune bascule, aucune suppression de v1 sans son accord.

## 7. Correctifs appliqués (2026-07-21)

### 7.1 Composition = poids détenus (points 1 & 2)
- **Moteur** (`backtest.ts`) : le résultat OK expose désormais **`heldAllocation`** (poids réellement
  détenus au dernier mois = position courante, base de la performance réelle) et **`targetAllocation`**
  (poids cibles théoriques avant la bande). En **v1** (sans bande), `heldAllocation === targetAllocation`.
- **UI** (`quadrants-country-view` / `CompositionCard`) : sous v2, la carte affiche **`heldAllocation`**
  (sous-titre « Allocation réellement détenue »). Si détenu et cible **divergent au %**
  (`compositionDiverges`, indépendant du seuil), un **bloc secondaire** liste **Actuelle (détenu)**
  vs **Cible** + le statut **« Aucune réallocation ce mois-ci — allocation conservée »**. Si identiques
  → une seule composition. **En v1 le rendu est strictement inchangé** (held === target, sous-titre « cible »).
- **Vérifs demandées** : ✅ **Sources de performance** = poids détenus (contributions calculées sur
  `held` dans la boucle) · ✅ **Rotation** = transactions réellement exécutées (turnover = 0 quand la
  bande retient) · ✅ **Aucun** autre composant AFFICHÉ ne réutilise `finalAllocation` comme poids
  détenus (`decision-panel` utilise `finalAllocation` mais **n'est pas affiché** — phase 2 masquée ;
  `helpers.ts` l'utilise pour une phrase de **régime** en comparaison, pas comme position détenue).

### 7.2 Méthodologie sans révéler δ (point 7)
`quadrants-methodology` rendu **version-aware** (gaté sur `IS_STAGING_V2` ⇒ **v1 inchangé**) :
- « Réallocation mensuelle sans anticipation » → sous v2 : *« … le portefeuille n'est réalloué que
  lorsque l'écart entre l'allocation détenue et l'allocation cible devient suffisamment significatif… »*.
- Hypothèse « intégralement ramené chaque mois / pas de seuil » → remplacée par « Réallocation
  **conditionnelle** » (même formulation, sans chiffrer).
- Rotation → ajout : *« La rotation mesure uniquement les réallocations effectivement exécutées… »*.
- **Ni `δ`, ni 5 %, ni la formule de décision ne sont mentionnés.**

### 7.3 Tests & validation
- **`band.test.ts`** : + test « position courante » (mois bloqué type GB : détenu ≠ cible, **perf =
  détenu** [nominal 102,5 ≠ 102,8], **rotation nulle**, cible dispo ; v1 : détenu === cible).
- **`composition.test.ts`** : transformation `compositionDiverges` (identiques → non ; cas GB → oui).
- **Golden v1 `standard-v1.test.ts` : STRICTEMENT inchangé** (fichier `golden.json` non modifié).
  Golden v2 `standard-v2.test.ts` : inchangé.
- **212 tests verts · tsc · ESLint · build OK** (build sans flag ⇒ v1, production inchangée).

### 7.4 Fichiers modifiés / ajoutés (correctifs)
| Fichier | Nature |
|---|---|
| `src/lib/coredata/four-quadrants/backtest.ts` | + `heldAllocation` / `targetAllocation` (suivi `held` courant) |
| `src/app/(admin)/modeles/quadrants/helpers.ts` | + `compositionDiverges` |
| `src/app/(admin)/modeles/quadrants/quadrants-country-view.tsx` | `CompositionCard` détenu/cible + bloc secondaire |
| `src/app/(admin)/modeles/quadrants/quadrants-methodology.tsx` | passages gatés v2 (sans δ) |
| `src/lib/coredata/four-quadrants/band.test.ts` | + test mois bloqué (position courante) |
| `src/app/(admin)/modeles/quadrants/composition.test.ts` | *(nouveau)* test transformation |
| `experiments/4q-stabilisation/etude2-recette-v2.md` | ce rapport (mis à jour) |

## 8. Sélection par VERSION (≠ staging) & cache (2026-07-21)

### 8.1 Contenu piloté par la version active, pas par le staging
`model-version-active.ts` sépare désormais deux concepts :
- **`IS_MODEL_V2`** = `ACTIVE_MODEL_VERSION === "v2"` → **contenu** spécifique v2 (Méthodologie,
  Composition « détenu vs cible »). **Suit la version active** : lors de la mise en production de v2
  (défaut basculé), la formulation « réallocation conditionnelle » **reste affichée sans le flag**.
- **`IS_STAGING_V2`** = `IS_MODEL_V2 && DEFAULT_MODEL_VERSION !== "v2"` → **bannière interne**
  seulement (v2 forcée par le flag alors que le défaut reste v1). Disparaît quand v2 devient le défaut.

La Composition (`v2={IS_MODEL_V2}`) et la Méthodologie utilisent **`IS_MODEL_V2`** ; seule la
bannière garde `IS_STAGING_V2`. **Seuil/formule toujours confidentiels.**

### 8.2 Cache / préchargement : aucune fuite v1↔v2
- Page 4Q en **`export const dynamic = "force-dynamic"`** → pas de Full Route Cache ni de prérendu.
- **Aucun** `unstable_cache` / `revalidate` / `"use cache"` / `React.cache` / cache `fetch` dans
  `coredata` ou la page 4Q (le service lit la base via `pg` Pool — pas de cache de réponse Next).
- La version est une **CONSTANTE DE BUILD** (`NEXT_PUBLIC_QS_MODEL_VERSION` inline, client + serveur) :
  toute l'instance rend **une seule version** ⇒ **aucun mélange v1/v2** possible à l'exécution ; une
  réponse v1 ne peut pas servir une page v2. Les actions serveur lisent la même constante.
- Mémoïsation client (`quadrants-view`) : documentée — la version étant une constante de build,
  aucune dépendance de mémo n'est requise ; **si la version devenait dynamique, l'ajouter aux deps
  ET aux clés des actions serveur** (noté dans le code).

## 9. Ajustements desktop (retour recette Yann, 2026-07-21)

Comportement **validé** côté desktop (distinction détenu/cible correcte : les poids détenus
**dérivent** avec les performances relatives — ex. 48/52, 53/47 — et sont **conservés** tant que
l'écart à la cible reste insuffisant ; **jamais forcés à 50/50**). Deux ajustements d'affichage
appliqués au bloc secondaire de la Composition :
1. intitulé **« Actuelle » → « Détenue »** ;
2. **même ordre d'actifs** dans la composition principale et le tableau Détenue/Cible (tri par poids
   détenu, via `sleeves`) ;
3. (option retenue) **flèche `Détenue → Cible`** sur les seules lignes qui diffèrent — lisible, sans
   révéler ni seuil ni formule.

**Reste avant Go final** (côté Yann) : recette **responsive** (mobile/tablette/bureau), vérification
**Méthodologie** v2, **console/hydratation**. `rc2` sera créé **après** cette recette complète.

## 10. Recette visuelle COMPLÈTE — VALIDÉE (Yann, 2026-07-21)

Recette réalisée en local avec `NEXT_PUBLIC_QS_MODEL_VERSION=v2`. Tous les points **conformes** :

| Contrôle | Résultat |
|---|---|
| Les 4 onglets (Vue pays · Comparaison · vs Actions · Méthodologie) sans régression | ✅ |
| GB : Composition principale = poids **détenus** (≠ cible) | ✅ |
| Bloc « Détenue / Cible » apparaît en divergence, disparaît si identiques | ✅ |
| Arrondis & totaux des allocations cohérents (détenus dérivés, jamais forcés 50/50) | ✅ |
| Rotation / fréquence / sources de performance cohérentes avec les poids détenus | ✅ |
| Méthodologie v2 **sans** seuil ni formule confidentiels | ✅ |
| Navigation entre pays & rechargements — aucun mélange v1/v2 | ✅ |
| Console / hydratation — aucune erreur | ✅ |
| Rendus **mobile / tablette / bureau** | ✅ |
| Comportement **v1** après relance **sans** le flag — inchangé | ✅ |

⇒ **Candidat figé `4q-standard-v2-rc2`.** La suite (fusion + bascule production) est décrite dans
`etude2-v2-bascule-plan.md` et attend la décision Go/No-Go de Yann.

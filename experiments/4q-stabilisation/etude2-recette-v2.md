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
| 8 | Aucune régression responsive/visuelle | ✅ *(attendu)* | Diff = ajout d'une bannière + valeurs (rotation/perf) qui baissent ; **aucun changement de structure/layout**. *(Confirmation visuelle à faire, cf. §5.)* |
| 1 | Allocation affichée = poids **détenus**, pas systématiquement la cible | ❌ **DIVERGENCE** | La carte « Composition du portefeuille » affiche `latest.finalAllocation` = **la CIBLE** (la bande ne change pas les cibles). |
| 2 | Un mouvement bloqué par la bande ≠ réallocation affichée | ❌ **DIVERGENCE** | Corollaire du #1 : quand la dernière réallocation est bloquée, l'UI montre la cible comme si le portefeuille l'avait rejointe. |

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

## 6. Recommandation — **NO-GO (conditionnel) pour la bascule production**

Le **moteur v2 est validé et correct** ; **les métriques (rotation, fréquence, performance,
périodes) s'affichent juste** et concordent. **MAIS deux correctifs sont requis AVANT toute bascule** :

1. **[Bloquant] Composition = poids détenus** (exposer `held` courant, afficher Détenu/Cible).
2. **[Bloquant] Méthodologie** : réécrire les 2-3 passages « réallocation mensuelle intégrale / pas
   de seuil » pour décrire le principe de la bande **sans révéler δ**.
3. **[À confirmer] Recette visuelle/responsive** par Yann (auth requise).

Une fois ces points traités et re-validés → **Go** possible pour la bascule (page par page, v1
conservé pour rollback). **En l'état : NO-GO** — ne pas basculer la production.

⚠️ Rappel : aucun merge, aucune migration, aucune suppression de v1 avant validation finale de Yann.

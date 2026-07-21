# Étude Énergie — synthèse & recommandation

> **Question de recherche.** *« Existe-t-il une manière robuste d'ajouter une poche
> Énergie qui améliore DURABLEMENT le modèle 4 Quadrants ? »*
>
> **Réponse : NON.** Aucune configuration testée n'améliore le modèle de façon robuste.
> Le socle **`4q-standard-v1` reste la référence** ; l'Énergie **n'ouvre pas** de `v2`.
>
> Étude entièrement expérimentale, **moteur `four-quadrants/` non modifié**. Reproductible :
> `study.mts` (balayage) + `analyze.mts` (analyse) + `results.json` / `results-tables.md`.

## 1. Dispositif

- **Poche Énergie** = MSCI World Energy TR (`MXWO0EN Index-XX-1-2`), convertie en devise locale
  comme l'or (jamais le WTI générique, cf. audit §1). Overlay appliqué **après** l'allocation cœur
  du moteur figé, `t → t+1` sans look-ahead.
- **Espace balayé** (famille paramétrée `w_E = w_max · g(x,y ; shape, T_E)`, gate boom `x>0 ∧ y>0`,
  intensité `min(x,y)`) :

  | Dimension | Valeurs |
  |---|---|
  | `w_max` | 0*, 5, 10, 15, 20, 25, 30 % |
  | `T_E` (seuil activation) | 0, 10, 20, 30, 40, 50 |
  | `shape` | step (fixe) · ramp (progressive) |
  | financement | prorata · bloc boom (actions+or) · cash (avec débordement) |
  | stratégie | dynamique · binaire |
  | `T` (zone neutre moteur) | 0, 20, 50 |
  | horizon | Max (1995→) · 20A · 10A · 5A |
  | coûts | net 10 / 25 / 50 bps |

  *`w_max = 0` = **témoin** = socle sur la même fenêtre 1995→.

- **Panel** : 21 pays (DK exclu, 21 mois). **109 368 backtests**, agrégés en 5 184 cellules.
- **Statistiques de robustesse** (jamais une moyenne seule) : médiane, quartiles Q1/Q3, **pire décile**,
  **% de pays améliorés**, sur **chaque** horizon.
- **Ancrage de correction** : la cellule `w_max=0` reproduit **exactement** le socle
  (US réel **6,32 %**, 493 mois) — la mécanique d'overlay est validée.

## 2. Résultats

### 2.1 Aucune amélioration, nulle part
Sur les **5 184 cellules**, la **meilleure médiane ΔSharpe réel (net 25 bps) = +0,008** — à comparer
au seuil d'admissibilité **+0,050**. **0 cellule** dépasse +0,05 ; **0** dépasse +0,02 ; seulement
**260/5 184 (5 %)** ont une médiane > 0, toutes de niveau **bruit** et avec un **pire décile négatif**.

### 2.2 La « meilleure » config = « le moins d'Énergie possible »
La cellule optimale, sur **tous** les horizons et les deux stratégies, converge vers le **plus petit
poids** (`w=5 %`) au **seuil le plus haut** (`T_E=50`, Énergie active ~6 % des mois) :

| Stratégie | Horizon | Meilleure cellule | ΔSharpe (méd.) | pire décile | % pays améliorés |
|---|---|---|---|---|---|
| dynamique | Max | step/cash T_E=50 w=5% | **+0,003** | −0,019 | 62 % |
| dynamique | 20A | step/cash T_E=50 w=5% | +0,003 | −0,021 | 62 % |
| dynamique | 10A | step/cash T_E=50 w=5% | +0,005 | −0,046 | 62 % |
| dynamique | 5A | step/cash T_E=30 w=5% | +0,006 | −0,027 | 62 % |
| binaire | Max | step/prorata T_E=50 w=5% | +0,000 | −0,016 | 52 % |

L'« optimum » est donc **≈ éteindre la poche**. Signature classique d'une brique qui **n'apporte rien**.

### 2.3 Plus d'Énergie = dégradation monotone (pas de plateau)
Carte de robustesse `(T_E × w_max)` — dynamique, T=20, **step/prorata**, Max — *médiane ΔSharpe (% pays améliorés)* :

| T_E \ w_max | 5% | 10% | 15% | 20% | 25% | 30% |
|---|---|---|---|---|---|---|
| **0** | −0,010 (33%) | −0,031 (14%) | −0,062 (10%) | −0,093 (5%) | −0,135 (5%) | −0,180 (0%) |
| **20** | −0,011 (29%) | −0,032 (24%) | −0,060 (14%) | −0,099 (14%) | −0,140 (10%) | −0,185 (10%) |
| **50** | **+0,001 (62%)** | −0,005 (43%) | −0,023 (38%) | −0,046 (29%) | −0,076 (29%) | −0,102 (29%) |

Toute la surface est **négative** sauf le coin « quasi-off » (`T_E=50, w=5%`). Le gradient est net et
identique pour les 3 financements (moyenne sur `T_E` & `shape`, dyn/T=20/Max) :

```
prorata   | 5%:-0.004  10%:-0.015  15%:-0.031  20%:-0.052  25%:-0.078  30%:-0.106
boombloc  | 5%:-0.005  10%:-0.016  15%:-0.033  20%:-0.056  25%:-0.084  30%:-0.113
cash      | 5%:-0.003  10%:-0.011  15%:-0.025  20%:-0.046  25%:-0.069  30%:-0.097
```

Il n'existe **pas** de zone robuste : le « plateau » de meilleure performance est à **`w_max = 0`**.
(L'ordre cash < prorata < boombloc est économiquement **cohérent** — financer par le cash sans risque
coûte le moins, sacrifier le bloc boom actions+or coûte le plus — ce qui **valide la mécanique**, ce
n'est pas un artefact.)

### 2.4 Pas de bénéfice de risque non plus
La meilleure **réduction de drawdown réel** est ~0 pt sur Max, et ne devient légèrement positive
(~+2 pt) que sur des sous-fenêtres 10A/5A, **au prix d'un Sharpe négatif** et pour 1-2 pays seulement
(pire décile ≈ 0). L'Énergie n'améliore ni le rendement, ni le risque.

### 2.5 Même l'épisode inflationniste récent (5A, 2021→) ne sauve pas la thèse
Sur la fenêtre *a priori* la plus favorable (inflation 2021-2022), le meilleur cas donne
ΔSharpe **+0,006** mais un **ΔCAGR négatif (−0,27 pt)** : la poche **actions énergie** a subi le
drawdown actions de 2022 et le retard d'entrée (`t→t+1` + MM7) → elle **retire** du rendement même là.

### 2.6 Test d'admissibilité : rien ne passe
Aucune config `(shape, T_E, w_max, financement)` ne satisfait le critère **strict** (médiane ΔSharpe ≥
+0,05 **et** % améliorés ≥ 60 **et** pire décile ≥ 0 sur **les 4 horizons**). Ni même le critère
**relâché** (médiane ≥ 0 & % améliorés ≥ 55 sur les 4 horizons) : **0 config**. La « meilleure »
cellule est en outre **invariante à T** (0/20/50 → +0,002/+0,003/+0,003) : c'est du **bruit**, pas un signal.

## 3. Pourquoi l'Énergie ne fonctionne pas ici (interprétation)

1. **La poche est de l'*actions* énergie, pas du pétrole.** Elle porte un **bêta actions** déjà
   présent dans la poche Actions → elle **concentre** au lieu de diversifier.
2. **Le régime cible est rare** (~14-23 % des mois) : le tilt est éteint la plupart du temps, et quand
   il s'allume, financer la poche revient à **échanger une position diversifiée contre un secteur
   volatil** unique — un mauvais échange en espérance.
3. **Retard structurel** (`t→t+1` + MM7 84 mois) : l'Énergie entre **après** confirmation du boom et
   est souvent conservée **dans le retournement** — l'énergie étant momentum/mean-reverting, le retard coûte.
4. **Coûts de transaction** : la poche on/off **ajoute de la rotation** (+1 à +8 pt/an) ; le minuscule
   frémissement brut passe **négatif net de coûts**.

## 4. Recommandation

**Ne pas intégrer de poche Énergie.** Le socle **`4q-standard-v1`** reste la référence — il n'est
**pas** amélioré durablement par l'Énergie, sous aucune des 5 184 configurations, sur aucun horizon,
avec aucun financement, dans aucune des deux stratégies. C'est une **non-intégration justifiée par les
données** (résultat explicitement acceptable), et non un renoncement à la complexité.

**Ce qui pourrait rouvrir la question** (documenté, pas exploré) :
- Une vraie **exposition matière première roulée** (indice type GSCI/BCOM Energy TR, ou pétrole
  physique) — **absente de la base** — a un profil différent (moindre bêta actions, portage de roll) et
  mériterait un nouveau balayage **si la donnée est ajoutée**.
- Cette étude teste l'Énergie comme **poche de performance**. Elle ne conclut **rien** sur un éventuel
  usage de l'énergie comme **raffinement de signal** (déjà au dénominateur de l'axe Croissance).

`4q-standard-v1` reste donc la référence ; **aucun `4q-standard-v2` issu de l'Énergie**.

## 5. Reproductibilité
- `experiments/4q-energie/study.mts` — balayage (109 368 backtests, ~2 min).
- `experiments/4q-energie/analyze.mts` — statistiques de robustesse.
- `experiments/4q-energie/results.json` — 5 184 cellules agrégées.
- `experiments/4q-energie/results-tables.md` — cartes de plateau (toutes tranches).
- Audit amont & protocole : `docs/4q-energie-0-audit-protocole.md`.

# 4 Quadrants — Protocole expérimental : méthodes de stabilisation

> **Statut : protocole (non implémenté).** Aucune ligne de moteur n'est modifiée par
> ce document. La référence est le jalon **`4q-standard-v1`** (tag Git). Toute variante
> de stabilisation sera codée dans une **section expérimentale séparée**, sans toucher
> au socle Standard v1 (qui reste figé et couvert par sa non-régression).
>
> Rappel de cadrage : **ni Énergie ni comparaison Browne** dans cette phase.

## Idée

Le Standard v1 réalloue **intégralement chaque mois** vers la cible du signal. Cela
maximise la réactivité mais génère de la **rotation** et des **changements de poids
fréquents**, parfois pour de petits mouvements de signal (bruit près des frontières).
La stabilisation cherche à **réduire la rotation et la fréquence des changements de
poids** sans dégrader significativement le **rendement réel** ni le **risque**.

La stabilisation est une **couche de politique de réallocation** appliquée *après* la
cible du signal (cf. §18 de la spec, « couche séparée reportée ») : elle transforme la
suite (cible du signal, poids réellement détenus) en **poids effectivement tenus**,
avant le calcul `t → t+1`. Le signal, les coordonnées, le régime et la cible NE
changent pas ; seule la **règle d'exécution** change.

---

## 1. Méthodes étudiées (étude 1 : au plus 3 variantes)

| Clé | Méthode | Principe |
|---|---|---|
| `standard` | **Standard v1 (référence)** | Réallocation mensuelle intégrale vers la cible. Aucune stabilisation. |
| `band` | **Bande minimale de réallocation** (no-trade band) | On ne réalloue que si l'écart aux poids détenus dépasse un seuil `δ` ; sinon on **conserve les poids dérivés** (pas de transaction ce mois-ci). Filtre les petits ajustements. |
| `hysteresis` | **Hystérésis** | On ne fait basculer l'allocation d'un bloc que si la coordonnée franchit un seuil **plus large** (`T + h`) que celui qui l'y maintenait (`T`). Zone de maintien `[T, T+h]` du côté déjà tenu → supprime les allers-retours près des frontières. |

**Réservé à l'étude 2** (hors de cette étude) : modulation de l'allocation par la
**vitesse / accélération** du régime (cinématique déjà exposée par le moteur).

### Précisions de mise en œuvre (à figer avant de coder)
- `band` : **bande globale** pour l'étude 1 — on ne réalloue vers la cible que si la
  rotation-vers-cible du mois `½·Σ|cible − détenu| > δ` ; sinon on garde les poids
  détenus. (Variante « bande par poche » avec renormalisation = à réserver à une
  itération ultérieure, plus complexe.)
- `hysteresis` : appliquée **sur les coordonnées** (frontière de la zone neutre `T`).
  Le côté « tenu » d'un axe n'est abandonné que lorsque `|coord|` repasse sous `T`
  **et** de l'autre côté au-delà de `T + h` (bande de maintien `h`). N'affecte que la
  **cible exécutée**, jamais les coordonnées/quadrant affichés.

## 2. Paramètres

| Méthode | Paramètre | Balayage proposé |
|---|---|---|
| `standard` | — | (référence) |
| `band` | `δ` (points de % de rotation mensuelle) | `{1, 2, 3, 5}` |
| `hysteresis` | `h` (points de coordonnée, largeur de maintien) | `{5, 10, 20}` |

**Constantes communes** (héritées de Standard v1, non balayées dans l'étude 1) :
stratégie **dynamique** (principale) + **binaire** (contrôle) · zone neutre `T = 20` ·
DQAE · `t → t+1` (zéro look-ahead) · **pas de coûts de transaction** appliqués (mais la
rotation est **mesurée**).

## 3. Référence

**Standard v1** = tag `4q-standard-v1` (fixtures pays réels US/BR/DK + golden,
tolérances explicites). Toute variante est évaluée **sur les mêmes séries, pays,
périodes, stratégies et zone neutre** que la référence. Le golden v1 garantit que la
référence n'a pas dérivé entre deux exécutions de l'étude.

## 4. Métriques de comparaison

Toutes **relatives au Standard v1** (Δ = variante − référence), par pays × période.

- **Rendement réel** : CAGR réel, multiple réel.
- **Risque** : volatilité réelle, max drawdown réel, durée max sous l'eau, Sharpe réel
  (excédent sur le cash).
- **Rotation** : rotation annualisée (turnover unidirectionnel `½·Σ|cible − détenu|`).
- **Fréquence des changements de poids** *(à définir précisément, proposition)* :
  - part des mois où le **turnover mensuel > ε** (ex. `ε = 0,5 %`) ;
  - et/ou nombre de **bascules de la poche dominante** ;
  - et/ou nombre de **changements de quadrant/zone** effectivement exécutés.
- **Métrique de compromis dérivée** : **efficience de rotation** = `Δ rendement réel /
  Δ rotation` (rendement réel conservé par unité de rotation économisée) ; lecture sur
  un **plan rotation (x) × rendement réel ou Sharpe (y)** — une méthode *domine* si elle
  est au **nord-ouest** (moins de rotation, autant ou plus de rendement-risque).

## 5. Panel (pays & périodes)

- **Pays** : panel représentatif — les **22 pays** (analyse principale) ou un
  sous-ensemble stable ≥ 8 couvrant les profils : forts (US, CH, NO), cash élevé (BR,
  IN), atypiques (JP, HK), court (DK). Les 3 pays du golden (US, BR, DK) servent de
  points d'ancrage.
- **Périodes** : **Max** (analyse principale, historique complet) + **20A / 10A / 5A**
  (robustesse). Mêmes fenêtres que v1.
- **Stratégies** : **dynamique** (principale) + **binaire** (contrôle).
- **Zone neutre** : `T = 20` (défaut) ; sensibilité sur `{0, 50}`.

## 6. Critères de rétention / rejet

Décision fondée sur la **médiane inter-pays** (robustesse) + la **dispersion**, jamais
sur un seul pays. Seuils chiffrés **à valider avec Yann avant l'étude** ; proposition de
départ :

- **RETENUE** si la méthode **réduit sensiblement la rotation et/ou la fréquence des
  changements de poids** (ex. **rotation −30 %**) **sans dégrader** :
  - le rendement réel au-delà de **−0,3 pt/an** de CAGR réel (médiane) ;
  - le risque : max drawdown réel non aggravé de plus de **~2 pts**, Sharpe réel non
    dégradé de plus de **~0,05**.
- **ÉCARTÉE** si : gain de rotation insuffisant au regard de la perte de rendement/
  risque ; **ou** la baisse de réactivité aggrave le drawdown dans les régimes de
  bascule ; **ou** l'effet est trop dispersé (bénéfice sur certains pays, nette
  dégradation sur d'autres).
- **Choix du paramètre** (`δ`, `h`) : le plus grand qui reste dans la zone « RETENUE »
  (rotation minimale sous contrainte de non-dégradation), documenté.

---

## Sortie attendue de l'étude 1

1. Table `variante × paramètre × pays × période` des métriques ci-dessus.
2. Synthèse : médianes inter-pays + plan de compromis **rotation × rendement-risque**.
3. Recommandation motivée **retenir / écarter** par méthode, avec le paramètre retenu.
4. Aucune modification du socle Standard v1 : la stabilisation reste **expérimentale et
   séparée** tant qu'une méthode n'est pas validée (et, si validée, elle deviendra une
   **option** explicite, pas le défaut, sans casser la non-régression v1).

## Étude 2 (ultérieure, hors périmètre)

Modulation de l'allocation par la **cinématique** (vitesse / accélération du régime) :
anticiper/atténuer les bascules selon la dynamique. Mêmes référence, métriques et
critères ; comparée à la fois au Standard v1 et à la meilleure méthode de l'étude 1.

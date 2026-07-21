# Énergie 0 — Audit des données & protocole de recherche quantitative

> **Statut : LECTURE SEULE.** Ce document ne code ni allocation Énergie, ni réglage UI,
> ni comparaison avec Browne. Il précède toute implémentation. Le socle officiel reste
> `4q-standard-v1` (figé, tag Git) tant qu'un remplaçant n'est pas **démontré**.
>
> Reproductibilité de l'audit : `experiments/4q-energie/audit-data.mjs` (métadonnées +
> profondeur + trous, SQL sur `coredatadb`) et `experiments/4q-energie/regimes-frequence.mts`
> (fréquence du régime via le moteur figé). Données vérifiées le 2026-07-21.

> **⚙️ Cadre de recherche (2026-07-21).** À partir de cette étude, la priorité passe de
> « simplicité produit d'abord » à **optimisation quantitative du modèle sous contrainte
> anti-surapprentissage**. Aucune piste n'est écartée *a priori* pour sa complexité ou parce
> qu'elle demande d'explorer des paramètres éloignés (**seuils élevés inclus**). Règles :
> 1. **jamais** d'optimisation pour un pays particulier ;
> 2. rechercher un **paramètre global** valable sur l'ensemble des pays ;
> 3. privilégier les **plateaux** de performance plutôt qu'un optimum ponctuel ;
> 4. vérifier la robustesse sur **plusieurs horizons** (Max, 20A, 10A, 5A) ;
> 5. évaluer par **statistiques de robustesse** (médiane, quartiles, pire décile, proportion de
>    pays améliorés) — **pas** une simple moyenne.
>
> Démarche : (1) définir un espace de paramètres large → (2) l'explorer systématiquement →
> (3) identifier les **zones robustes** plutôt que le meilleur score isolé → (4) comparer les
> compromis rendement / risque / rotation / stabilité → (5) recommander **un seul** jeu de
> paramètres globaux avec **justification statistique**. Toute reco doit démontrer sa robustesse
> **hors d'un cas particulier**. Une amélioration suffisamment solide remplacera le socle et
> ouvrira le jalon **`4q-standard-v2`** ; jusque-là, `4q-standard-v1` est la référence de comparaison.

---

## 1. Audit des données Énergie disponibles

### 1.1 Série utilisée pour le pétrole dans le signal

| Champ | Valeur |
|---|---|
| **Id** | `CL1 comdty-XX-5-1` (constante `GLOBAL_OIL_ID` du service) |
| **Ticker Bloomberg** | `CL1 comdty`, champ **`PX_LAST`** |
| **Nom** | *Generic 1st 'CL' Future* (WTI, contrat générique 1ᵉ échéance) |
| **Classe / type** | 5 (matière première) / 1 (Prix) — secteur nul |
| **Devise / pays** | USD / `XX` (pseudo-pays global) |
| **Profondeur** | **1960-01 → 2026-06**, 798 mois, **0 trou** mensuel |

**Usage réel** (`four-quadrants/ratios.ts`, `build-model.ts`) : le pétrole n'apparaît **qu'au
dénominateur de l'axe Croissance** — `x = 100·tanh(z(ln(Actions_prix / Pétrole)))`. Converti en
devise locale (comme l'or), puis normalisé (MM7 robuste). Il **n'est jamais** un rendement de poche.

### 1.2 Spot, futur ou total-return ?

**Prix de future**, pas spot ni total-return : le **PX_LAST du future WTI générique 1ᵉ échéance**.
« Générique 1ᵉ échéance » = la série suit toujours le contrat le plus proche et **bascule** sur
l'échéance suivante à l'expiration. Le PX_LAST générique est **non ajusté du roll** : à la bascule,
la série saute du prix de l'ancien au prix du nouveau contrat sans neutraliser l'écart d'échéance.

### 1.3 Peut-elle représenter une poche investissable ? **NON.**

Rester exposé au pétrole via futures oblige à **rouler** les contrats. En **contango** (cas
dominant du WTI), le roll **coûte** (on vend bas, rachète plus haut) → rendement de roll négatif
de plusieurs pts/an vs le prix générique. Le PX_LAST **efface** ce portage. Donc `CL1` est légitime
en **signal** (niveau relatif), **inutilisable en rendement de poche** (surestime structurellement
ce qu'un investisseur encaisse). ⇒ *la série du signal ne devient pas la poche.*

### 1.4 Seule exposition Énergie **investissable** de la base

La base ne contient **aucun** indice de matières premières **roulé** (pas de GSCI/BCOM Energy TR),
**aucun** Brent, **aucun** indice énergie **par pays**. La seule exposition réplicable :

| Champ | Valeur |
|---|---|
| **Id (poche candidate)** | `MXWO0EN Index-XX-1-2` |
| **Ticker** | `MXWO0EN Index` — *MSCI WORLD / ENERGY* |
| **Classe / type / secteur** | 1 (indice boursier) / **2 (total-return)** / 10 (énergie) |
| **Devise / pays** | USD / `XX` (global) |
| **Profondeur** | **1995-01 → 2026-06**, 378 mois, **0 trou** mensuel |
| **Variante prix** | `MXWO0EN Index-XX-1-1` (ty1), mêmes bornes |

⚠️ Ce sont des **actions du secteur énergie mondial** (majors, E&P, services), **pas le pétrole**.
Cette poche porte donc un **bêta actions** + une sensibilité au prix de l'énergie + des dividendes.
Exposition « énergie » détenable et honnête, mais **corrélée aux actions** — point structurant pour
le rôle (§2) et les risques.

### 1.5 Roll, changements de contrats, conversion en devise locale

- **Roll / contrats** : *sans objet pour la poche candidate.* `MXWO0EN` est un indice d'actions —
  pas de contrats à terme, pas de roll. Le problème de roll ne concerne que `CL1`, d'où son maintien
  au **signal**.
- **Conversion locale** : comme l'or. `MXWO0EN` en USD/`XX` → converti dans la devise du pays via le
  pivot USD (`buildConverter`, flag `reverse`). L'investisseur local porte le **change USD/local** sur
  la poche, exactement comme sur l'or.

### 1.6 Profondeur & trous pour les 22 pays

Poche **globale** (une série `XX`, convertie par pays) — pas d'indice énergie national. Profondeur
intrinsèque identique partout : **1995-01, sans trou**. La contrainte vient du croisement avec la
fenêtre de chaque portefeuille 4Q :

| Sous-groupe | Pays | Début 4Q | Effet du plancher Énergie 1995 |
|---|---|---|---|
| **Longue histoire** | US, CA, JP (1985-06), HK (1988-02), GB (1997-10) | avant 1995 | **Perte du pré-1995** si Énergie activée (US/CA/JP/HK) |
| **Post-1995** | SE 2000, DE/CH 2002, NO 2003, FR 2004, KR/IN 2005, AU 2006, ES/MX 2007, BR 2008, CN 2010, ID/IT/SG/TW 2013 | après 1995 | **Aucune perte** |
| **Trop court** | DK (2024-10, 21 mois) | — | **À exclure** de l'analyse Énergie |

**Conséquence** : toute comparaison Énergie vs socle se fait sur une **fenêtre commune démarrant en
1995**, avec **Standard v1 re-mesuré sur cette même fenêtre** (pas sur ~1985), sinon on mélange
« effet Énergie » et « années en plus ». Le backtest **refuse** proprement une fenêtre où une poche
exigée manque (jamais de reconstruction) — le socle est protégé.

---

## 2. Rôle économique — **prior** d'ancrage (≠ filtre a priori)

Pour éviter d'optimiser à l'aveugle, l'espace de recherche est **ancré** par une hypothèse
économique explicite. Ce prior **oriente** l'espace (là où l'Énergie a un sens), il **ne filtre pas**
les autres effets : l'exploration mesure de toute façon rendement **et** risque/drawdown, donc les
thèses « protection » et « diversification » restent **testées empiriquement**, quelle que soit
l'hypothèse de départ.

| Rôle | Statut | Raisonnement |
|---|---|---|
| **A. Croissance inflationniste** | **Prior retenu** | Le quadrant **boom inflationniste** (`x>0`, `y>0`) est *par construction* le régime croissance+inflation ; l'énergie en est l'actif archétypal, **complément de l'or** (or = inflation en contraction ; énergie = inflation **avec** croissance). L'ancrage vient de la logique 4Q, pas d'un backtest. |
| **B. Protection de choc** | À mesurer | Poche = **actions** (bêta actions) → *a priori* faible coussin (chocs 1974/2008 = récessions, actions énergie en baisse). L'exploration le **quantifiera** (ΔMDD réel). |
| **C. Diversification** | À mesurer | Corrélée aux actions → apport a priori limité, mais **mesuré** (vol, contribution propre, corrélation). |

**Prior d'ancrage : A — tilt de croissance inflationniste**, activé dans le boom inflationniste, en
complément de l'or. Formulation « débutant » : *« Quand le monde croît ET s'enflamme, on ajoute une
dose mesurée d'énergie, l'actif qui profite le plus de ce climat. »* La **quantité** de cette dose et
la **profondeur** du régime qui la déclenche sont précisément ce que l'exploration doit établir de
façon robuste — **pas** décidées d'avance.

---

## 3. Espace de paramètres (large)

L'Énergie est une **famille paramétrée** unique, dont les variantes « fixe » et « progressive » sont
deux cas particuliers. Cela évite d'opposer des variantes discrètes : on balaie un **espace continu**
et on cherche les **zones robustes**.

### 3.1 Forme fonctionnelle du poids Énergie

Par mois, à partir des coordonnées `(x, y)` (déjà produites par le moteur figé) :

```
Gate (prior §2)  : actif seulement si x > 0 ET y > 0            (boom inflationniste)
Intensité        : m = min(x, y)                                (les DEUX signaux requis)
Forme du poids   : selon `shape` ∈ {step, ramp}
   step (fixe)   : w_raw = 1           si m ≥ T_E,   sinon 0
   ramp (prog.)  : w_raw = clamp( (m − T_E) / (100 − T_E), 0, 1 )
Poids final      : w_E = w_max · w_raw
Overlay          : financement selon `finance` (§4), somme des poches = 1, aucun poids < 0
Décalage         : w_E figé à la clôture de t, appliqué aux rendements de t+1 (zéro look-ahead)
```

`m = min(x,y)` impose la **présence conjointe** de croissance et d'inflation (cohérent avec le prior).
`shape=step` reproduit la variante « fixe plafonnée » ; `shape=ramp` la variante « progressive selon
l'intensité conjointe ». `w_max = 0` **redonne exactement `4q-standard-v1`** (cellule témoin ⇒
contrôle de continuité intégré à la grille).

### 3.2 Dimensions balayées

| Paramètre | Valeurs explorées | Justification de la largeur |
|---|---|---|
| **`w_max`** (poids max Énergie) | `{0, 5, 10, 15, 20, 25, 30, 40} %` | `0` = témoin ; on **ne plafonne pas à 20 %** — seuils élevés autorisés pour détecter un éventuel plateau plus haut |
| **`T_E`** (seuil d'activation par axe) | `{0, 10, 20, 30, 40, 50, 60}` | de « toute la moitié TR » à « boom très net » ; **seuils élevés inclus** (consigne explicite) |
| **`shape`** | `{step, ramp}` | couvre fixe ↔ progressive dans une même famille |
| **`finance`** | `{prorata, cash, actions+or}` | trois financements (§4), y compris **cash** (avec règle de débordement, plus écarté a priori) |
| **`strategy`** (base) | `{dynamic, binary}` | l'Énergie doit se comporter sainement dans les deux |
| **`horizon`** | `{Max(1995→), 20A, 10A, 5A}` | robustesse temporelle obligatoire |
| **`cost`** (coûts transaction) | `{0, 10, 25, 50} bps` par unité de volume | le gain doit tenir **net de coûts** |

Grille structurelle brute : `8 · 7 · 2 · 3 · 2 = 672` configurations × 22 pays × 4 horizons ≈ 59 k
backtests (chacun pur, ~300-500 mois → coût négligeable). Exploré en **deux temps** (§5.1) pour
l'interprétabilité, mais l'espace reste **systématiquement** couvert.

---

## 4. Méthodes de financement (les trois balayées)

Contrainte absolue : **jamais de poids négatif, jamais de somme > 100 %.** Chaque méthode **borne**
`w_E` par la capacité des poches qui la financent ; tout dépassement **déborde** selon une règle
déterministe (pas d'exclusion a priori).

| Méthode | Mécanique + règle de bornage | Sens économique | Effet attendu |
|---|---|---|---|
| **Prorata (4 poches)** | chaque poche `× (1 − w_E)` | *« l'énergie remplace un peu de tout »* | neutre ; **dilue aussi les hedges** (oblig/cash/or) en plein boom |
| **Cash** | `w_E` prélevé sur le cash ; **débordement** = si `w_E > w_cash`, l'excédent est financé au prorata des poches restantes | *« on échange du sans-risque contre de l'énergie »* — geste offensif cohérent en boom | finance le risque par l'actif le moins risqué ; **débordement fréquent** en boom dynamique (cash déjà bas) → à mesurer, plus à écarter |
| **Actions + Or (bloc boom)** | `w_E` prélevé au prorata sur actions et or ; oblig+cash intacts ; borné à `w_E ≤ w_actions + w_or` | *« on réaffecte une part du pari de boom vers l'énergie »* | thèse la plus **propre** (énergie = substitut dans le bloc croissance+inflation) ; réduit l'or (hedge inflation) mais l'énergie hedge aussi l'inflation ; **hedges de contraction (oblig/cash) préservés** |

Les trois sont dans la grille (§3.2). Le **cash** n'est plus écarté : sa règle de débordement le rend
faisable et testable ; l'exploration dira s'il apporte quelque chose.

---

## 5. Protocole de recherche quantitative

### 5.1 Exploration systématique en deux temps

- **Passe A — cartographie structurelle.** Balayer `(w_max × T_E × shape)` sur la base de référence
  (`dynamic`, `prorata`), pour **tous** les pays × **tous** les horizons × tous les niveaux de coûts.
  Objectif : localiser les **zones robustes** dans le plan `(w_max, T_E)`, pour chaque forme.
- **Passe B — financement & stratégie.** Sur la **région de plateau** identifiée en A (et seulement
  là), balayer `finance ∈ {prorata, cash, actions+or}` × `strategy ∈ {dynamic, binary}`, mêmes
  pays/horizons/coûts. Objectif : trancher le financement et vérifier la tenue en binaire.

Chaque configuration est comparée au **même `4q-standard-v1`** sur **exactement la même fenêtre
effective** (1995→ commun ou horizon glissant), toujours en **réel** (déflaté CPI).

### 5.2 Panel & fenêtres
- **Panel** : 22 pays réels, **DK exclu** (21 mois).
- **Fenêtres** : Max (commun 1995→), 20A, 10A, 5A — une reco doit tenir sur **les quatre**.
- **Sous-panel « longue histoire »** (US/CA/JP/HK/GB) rapporté à part (seuls pays amputés pré-1995).

### 5.3 Métriques par (config, pays, horizon) — toutes en réel
Rendement réel (CAGR) · volatilité réelle · **max drawdown réel** · **Sharpe réel** (excédent cash) ·
durée sous l'eau · **rotation annualisée** · **fréquence & amplitude** des changements de poids ·
**contribution propre de l'Énergie** (`contributions.energy`) · le tout **net de coûts** (0/10/25/50 bps
sur `grossTradedWeight = 2·turnover`).

### 5.4 Statistiques de robustesse (jamais une simple moyenne)
Pour chaque config, sur les Δ vs socle (par pays), et **par horizon** :
- **médiane** des Δ (rendement, Sharpe, MDD, rotation) ;
- **quartiles Q1/Q3** (dispersion inter-pays) ;
- **pire décile** (les ~2-3 pays les plus dégradés) — garde-fou anti « gain porté par 1-2 pays » ;
- **proportion de pays améliorés** (`Δ > 0`) ;
- **cohérence inter-horizons** : signe et ampleur stables sur Max/20A/10A/5A.

### 5.5 Détection de plateau (cœur anti-surapprentissage)
Une cellule n'est **« robuste »** que si **elle ET ses voisines** (±1 pas en `w_max` et `T_E`)
partagent, **sur tous les horizons**, le même signe d'amélioration avec :
- médiane de gain (Sharpe réel **ou** MDD réel) au-dessus d'un seuil ;
- **proportion de pays améliorés** ≥ seuil (ex. ≥ 60 %) ;
- **pire décile non cassé** (pas de dégradation extrême) ;
- **net de coûts (25 bps)**.

⇒ on recommande le **centre du plus grand plateau contigu** qui **domine** le socle, **jamais** un
pic isolé. Un score maximal entouré de cellules dégradées = **rejeté** (signature d'overfitting).

### 5.6 Compromis multi-objectif
Vue **Pareto** (net de coûts) : gain de Sharpe réel vs **rotation ajoutée** ; gain de CAGR réel vs
**MDD réel**. La « stabilité » = régularité du gain à travers pays **et** horizons. On arbitre
explicitement : un petit gain de rendement qui **triple la rotation** ou casse le pire décile est écarté.

### 5.7 Décision & jalon
- **Un seul** jeu de paramètres globaux `(shape, T_E, w_max, finance, strategy)` recommandé, avec sa
  **justification statistique** (taille/position du plateau, médiane & quartiles des gains, pire décile,
  % de pays améliorés, tenue inter-horizons, net de coûts).
- Si un jeu **domine** robustement `4q-standard-v1` → proposition de **`4q-standard-v2`** (nouveau
  golden + non-régression, comme v1). Sinon → **non-intégration** documentée ; `v1` reste la référence.

---

## Restitution — risques méthodologiques & recommandation

### Risques méthodologiques
1. **Poche = actions énergie, pas pétrole.** Bêta actions inclus → thèse « protection de choc »
   fragile ; mesurée, jamais vendue comme acquise.
2. **Historique court & épisodes rares.** 1995→ (31 ans) ; boom inflationniste ≈ **22,7 %** des mois
   (14,1 % en version *nette* `x,y>20` ; agrégat 22 pays), **concentré** sur 2003-08 et 2021-22 →
   **petit échantillon d'épisodes « énergie-on »**. C'est LE risque d'overfitting : d'où plateau +
   pire décile + multi-horizon obligatoires, et le prior économique comme ancrage.
3. **Coûts de transaction.** Une poche qui s'allume/s'éteint ajoute de la rotation ; le gain brut peut
   être effacé net de coûts (leçon de l'étude de stabilisation).
4. **Change USD/local** sur la poche (comme l'or) ; en choc énergétique l'USD monte souvent → lecture
   « énergie » à démêler du change selon la devise.
5. **Décalage de régime** (`t→t+1` + MM7) : entrée/sortie tardives possibles sur un actif momentum.
6. **Effets de bord du financement** : prorata dilue les hedges ; cash déborde en boom ; actions+or
   réduit l'or. Tous mesurés (§4).
7. **Comparabilité** : Standard v1 **doit** être re-mesuré sur la fenêtre 1995→ (sinon biais d'années).

### Recommandation de démarche (Énergie 1)
1. **Donnée** : jamais `CL1` en poche. Si poche il y a → **`MXWO0EN Index-XX-1-2`** convertie en local,
   nommée honnêtement **« actions énergie »**.
2. **Construire le harnais d'exploration** dans `experiments/4q-energie/` (pur, réutilise
   `applyEnergyOverlay` / `energyScoreToWeight` / `backtestQuadrants` avec `energyTotalReturn` ; **le
   socle `four-quadrants/` n'est pas touché**), et lancer la **Passe A** (§5.1) sur toute la grille §3.
3. **Cartographier les plateaux** (§5.5) avant toute conclusion : produire, par horizon, la surface
   `(w_max, T_E)` des statistiques de robustesse (médiane / % pays améliorés / pire décile, net de coûts).
4. **Passe B** (financement, binaire) uniquement sur la région de plateau.
5. **Trancher** : un seul jeu global justifié statistiquement → `4q-standard-v2` **si et seulement si**
   il domine robustement le socle sur les 4 horizons, net de coûts, sans casser le pire décile ;
   sinon non-intégration assumée. `4q-standard-v1` reste la référence jusqu'à démonstration.

### Ce qui change vs la version « simplicité d'abord »
- On **n'écarte plus** : les seuils élevés (`w_max` jusqu'à 40 %, `T_E` jusqu'à 60), le financement
  **cash**, la forme **progressive** — tous **dans la grille**.
- On **ne présélectionne plus** « la variante la plus simple » : c'est l'**exploration** qui décide,
  sous contrainte de plateau robuste.
- L'anti-overfitting **demeure**, mais par la **méthode** (plateau, pire décile, multi-horizon, net de
  coûts, prior économique) — pas par un plafond de complexité arbitraire.

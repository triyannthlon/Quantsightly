# Étude Énergie v2 — surcouche mondiale sur `4q-standard-v2` — SYNTHÈSE

**Statut : NON-INTÉGRATION (recommandé).** Couche 100 % expérimentale, moteur `four-quadrants/`
et interface **non modifiés**. Menée en recherche quantitative ([[feedback-research-framework]]).

## 0. Contexte & hypothèse

La clôture de l'étude Énergie v1 (actions énergie MSCI World Energy `MXWO0EN`, non-intégration)
posait une **condition unique de réouverture** : disposer en base d'une **série matières premières
Énergie en total-return intégrant le rendement de roll** (type GSCI/BCOM). Cette condition est
désormais remplie : **`SPDYENT Index-XX-5-2`** = S&P GSCI Energy Dynamic Roll Total Return
(classe 5 matière première, type 2 TR, XX/USD).

Hypothèse testée (spécification canonique de Yann) : **une poche Énergie FIXE, activée par le boom
inflationniste du quadrant MONDE et financée AU PRORATA des 4 poches nationales, améliore-t-elle
robustement `4q-standard-v2` ?**

## 1. Audit de la série (avant tout backtest) — ✅ tout vert

| Contrôle | Résultat |
|---|---|
| Continuité mensuelle 1995-01 → 2026-06 | **378/378 mois, 0 trou** |
| Doublons / valeurs nulles / valeurs ≤ 0 | **0 / 0 / 0** |
| Granularité | mensuel pur, fin de mois (dates normalisées par Yann) |
| Rendements | 377 obs, 0 non finie ; vol 25,1 %/an ; CAGR USD 10,03 %/an |
| Devise / conversion locale | **USD** ; conversion date-exacte (même méthode que l'or) → 378 pts, 0 trou, toutes devises |
| Période rétrospective | **inception S&P GSCI Dynamic Roll = 27 janv. 2011** → backfill **1995-01 → 2011-01** (~192 mois), live **2011-02 → 2026-06** (~185 mois) |

## 2. Protocole (conforme à la spec canonique)

- **Allocation nationale** = `4q-standard-v2` inchangée (dynamique, T_national=20), pilotée par le
  quadrant **national**. Le quadrant Monde ne remplace jamais le quadrant national.
- **Quadrant MONDE** = `buildModel({ MXWO prix, CL1, XAU, GT10 }, USD)` — **même pipeline** que les
  pays. `x_w = ln(MXWO/CL1)`, `y_w = ln(XAU/GT10)`. GT10 = **indice de prix** obligataire US 10Y
  (vérifié : 1,00→46,68, CAGR 5,96 %, pas un taux). MXWO = **prix** (vérifié : écart TR−prix 2,25 pts
  = dividendes). Coords normalisées finales → seuils appliqués aux coords, pas aux logs bruts.
- **Gate canonique (strict)** : `energyActive = x_w > T_world ET y_w > T_world`. Poids fixe `e`.
- **Cible 5 poches (prorata)** : `[(1-e)A, (1-e)O, (1-e)G, (1-e)C, e]` si actif, sinon `[A,O,G,C,0]`.
- **Actif investi** = `SPDYENT` converti en devise locale (jamais dans le signal, jamais remplacé
  par CL1/MSCI World Energy).
- **Ordre §6** : cible 5 poches → **bande v2 (δ=5) appliquée UNE seule fois** sur les 5 poches →
  `t→t+1`. Coûts intégrés au compounding (convention étude 2). Rotation sur trades exécutés.
- **Témoin** = v2 (w=0) sur la **même fenêtre commune** (énergie passée → fenêtre identique).
- **Grille** : `T_world ∈ {0,10,20,30,40,50}`, `w ∈ {0,5,10,15,20,25}%`. Réf **T_world=20 / w=10 %**.
  Principal dynamique/T20/25 bps ; contrôles binaire, T_national∈{0,50}, coûts {0,10,50}. 21 pays
  (DK exclu, ~21 mois de signal).

**Garde-fous vérifiés** :
- **w=0 reproduit v2 EXACTEMENT** (US : realCAGR 6,447 %=6,447 %, rotation 26,79 %=26,79 %).
- **Simulation = moteur `backtestQuadrants`** au bit près, y compris cellule réf (6,614 %=6,614 %,
  rot 28,89 %=28,89 %) → la simulation implémente fidèlement l'ordre §6 (bande unique sur 5 poches).
- t→t+1 sans look-ahead ; poids = 100 % (prorata) ; FX = méthode des autres actifs mondiaux ;
  coûts sur turnover exécuté (la bande annule turnover et coûts sur les petits changements bloqués).

## 3. Résultat de surface (TROMPEUR) — le plateau semble robuste

Cellule de référence (T_world=20, w=10 %, dyn/T20, net 25 bps) :

| horizon | ΔSharpe (pire-décile) %imp | ΔCAGR | Δvol | ΔMDD | rotation | activation | poids É moyen détenu |
|---|---|---|---|---|---|---|---|
| Max | **+0,043** (+0,009) 100 % | +0,19 | −0,21 | +0,0 | +3,8 pt | 15 % | 1,5 % |
| 20A | +0,050 (+0,013) 100 % | +0,24 | −0,26 | +0,0 | +4,3 pt | 16 % | 1,6 % |
| 10A | +0,110 (+0,020) 100 % | +0,46 | −0,44 | +3,3 | +8,3 pt | 33 % | 3,2 % |
| 5A | +0,165 (+0,065) 100 % | +0,53 | −0,78 | +3,3 | +11,2 pt | 38 % | 3,8 % |
| Live | +0,062 (+0,013) 100 % | +0,29 | −0,31 | +0,0 | +5,4 pt | 21 % | 2,1 % |

Le plateau `T_world × w` est **quasi entièrement ✅** (pire-décile ≥ 0 & %imp ≥ 90) en Max ET en Live ;
robuste aux coûts (+0,047 à 0 bps → +0,040 à 50 bps pour w=10), aux stratégies (binaire +0,033,
T0 +0,039, T50 +0,049) et au **leave-one-country-out** (Max w10 : LOO min +0,043 = pleine). Aucun
pays ne porte le résultat (pire pays GB ≈ 0). **Une lecture superficielle conclurait « v3 ».**

## 4. Résultat en sous-périodes (LA VÉRITÉ) — le gain est un artefact d'UN épisode

| w=10 % | 95-00 | 01-05 | 06-10 | 11-15 | 16-20 | 21-26 | **pré-2021** | **Live 11-20** | Max |
|---|---|---|---|---|---|---|---|---|---|
| ΔSharpe | 0,000 | 0,000 | 0,000 | 0,000 | **−0,092** | **+0,256** | **−0,026** | **−0,041** | +0,043 |

Fréquence d'activation du **gate Monde** (boom inflationniste `x_w>0 ∧ y_w>0`) par tranche :

| 95-00 | 01-05 | 06-10 | 11-15 | 16-20 | 21-26 |
|---|---|---|---|---|---|
| **0 %** | **0 %** | **0 %** | 7 % | 27 % | **65 %** |

**Mécanisme (structurel, pas paramétrique)** :
1. **Inerte 1995-2015** (20 ans) : le gate Monde ne s'active jamais → ΔSharpe exactement 0,000, poche
   Énergie éteinte, portefeuille strictement identique à v2.
2. **Il rate structurellement les vrais bull markets énergie.** En 2006-2008 le pétrole écrase les
   actions ⇒ `x_w = ln(MXWO/CL1) < 0` ⇒ gate OFF. La condition `x_w>0` (actions battant le pétrole)
   est presque **l'opposé** d'un marché énergie haussier ⇒ le plus grand super-cycle énergie de
   l'échantillon (2006-2008) n'est **jamais capté**.
3. **Seule activation pré-2021 = 2016-2020** (27 % des mois) : l'énergie y est faible (pétrole
   $40-60 puis crash COVID) ⇒ ΔSharpe **−0,092** (perte franche).
4. **Tout le positif = le seul épisode 2021-2022** (+0,256), si violent qu'il domine toute fenêtre le
   contenant (Max, Live, 5A). Augmenter `w` ne fait que **léviter cet unique épisode** :
   w=25 % ⇒ 16-20 = −0,244, 21-26 = +0,346.

**Conséquence** : `pré-2021` et `Live 11-20` (méthodo live, avant le choc) sont **négatifs**. Le
« plateau robuste » mesure « quelle part du choc 2021-2022 as-tu captée », **pas** une robustesse
inter-régime. Sur les **deux** épisodes où le gate s'est activé, le bilan est **1 perte / 1 gain** —
soit un pari de régime, pas une amélioration structurelle durable. Le LOCO passe car il teste la
concentration par **pays**, jamais par **période**.

## 5. La règle canonique rejetée n'était peut-être qu'un mauvais SIGNE — test des 3 architectures

Le canonique ne rejette QUE `x_w>T ∧ y_w>T`. Or `x_w = ln(Actions/Pétrole)` est **à contre-sens** des
bulls énergie (pétrole domine → `x_w<0`). Étude préenregistrée restreinte (mêmes contraintes : SPDYENT
investi, CL1 signal seul, prorata, bande unique 5 poches, t→t+1, w=0 = v2). 3 architectures sur les
coords finales, `Tx,Ty∈{0,20,40}`, `w∈{0..20}%` :

- **A — inflation mondiale** : `active = y_w > Ty`
- **B — domination pétrole** : `active = x_w < −Tx`  *(le signe CORRECT pour un bull énergie)*
- **C — domination inflationniste** : `active = x_w < −Tx ∧ y_w > Ty`

**Activation par tranche (seuil 20)** — le signe corrigé (B) capte bien les vrais bulls énergie que le
canonique ratait :

| architecture | 95-00 | 01-05 | 06-10 | 11-15 | 16-20 | 21-26 |
|---|---|---|---|---|---|---|
| A (`y>20`) | 0 % | 28 % | **100 %** | 52 % | 18 % | **100 %** |
| B (`x<−20`) | 6 % | **90 %** | **100 %** | 47 % | 0 % | 20 % |
| C (`x<−20 ∧ y>20`) | 0 % | 28 % | 100 % | 47 % | 0 % | 20 % |

⇒ Hypothèse de Yann **validée sur ce point** : le signe comptait — B active l'Énergie pendant le
super-cycle 2000-2010 (et rate 2021-2022, où `x_w>0`).

**Mais aucune des trois n'améliore robustement le profil RISQUE-AJUSTÉ** (médiane ΔSharpe, w=10 %) :

| cellule | Max | **pré-2021** | Live 11-20 | 21-26 |
|---|---|---|---|---|
| A·Ty20 (inflation) | +0,063 | **−0,014** | −0,038 | +0,315 |
| B·Tx20 (pétrole, signe correct) | +0,011 | +0,005 | −0,012 | +0,022 |
| C·Tx20Ty20 | +0,009 | +0,000 | −0,012 | +0,022 |

**Analyse par ÉPISODES** (écart de log-perf réel cumulé ×100 ; robuste = positif après retrait du
meilleur épisode ET de 2021-2022) :

| cellule | total | leave-one-episode-out (pire) | retrait 2021-2022 | part meilleur épisode |
|---|---|---|---|---|
| A·Ty20 (2 épisodes) | +5,81 | +0,38 | **+0,38** | **94 %** |
| A·Ty0 | +9,15 | +1,35 | +2,42 | 77 % |
| B·Tx20 (correct) | +2,27 | **−0,18** | +0,74 | **96 %** |
| B·Tx0 (correct) | **−0,63** | −2,13 | +1,06 | 136 % |
| C·Tx20Ty20 | +0,95 | **−0,88** | **−0,88** | 170 % |

Lecture :
- **A (inflation)** = même histoire que le canonique : 94 % du gain dans le seul épisode 2019-2026,
  **pré-2021 risque-ajusté négatif**, ex-2021-2022 quasi nul. Pari 2021-2022.
- **B (signe correct)** capte le bull 2000-2010 en **rendement brut** (+1,75), mais tient l'Énergie
  dans les krachs (2008, 2022→2023) : à `Tx0` le total est **négatif** (−0,63) ; à `Tx20` le gain est
  concentré à **96 %** dans un épisode et **s'effondre au leave-one-episode-out** (−0,18). Le ΔSharpe
  reste **≈ 0 (bruit)** : la volatilité et l'exposition aux krachs annulent l'upside en rendement.
- **C** : négatif après retrait de 2021-2022.

**Bilan signaux macro** : à travers les **quatre** géométries de régime mondial (canonique `x>0∧y>0`,
A inflation, B pétrole au signe correct, C intersection), **aucune** ne produit un bénéfice
risque-ajusté robuste hors d'un épisode unique. Le diagnostic de Yann était juste (le signe de `x_w`
comptait), mais le corriger ne suffit pas : la poche Énergie **macro-pilotée** reste dominée par
2021-2022 ou noyée par sa volatilité/krachs. ⇒ **signaux macro de régime mondial : REJETÉS.**

## 6. Dernier test — SUIVI DE TENDANCE sur SPDYENT (autre famille de stratégie)

Faiblesse restante de B : il tient l'Énergie DANS les retournements. Un filtre de tendance sur l'actif
lui-même doit corriger précisément ça. Signal mondial (niveau USD) : `active_t = SPDYENT_t > SMA_L`,
décision à t appliquée à t+1, poche prorata convertie en local, UNE bande v2 sur 5 poches. **3
portefeuilles** : v2 sans énergie · Énergie toujours détenue à e · Énergie filtrée par la tendance.
Params préenregistrés : principal **L=12, w=10 %** ; robustesse L∈{6,9,12}, w∈{10,15,20}%.
`fichiers : trend.mts → trend-report.md`.

**Le filtre fonctionne mécaniquement** : rendement mensuel moyen SPDYENT **ON +3,17 % vs OFF −2,33 %**
(L=12) ; et il **ajoute de la valeur sur l'actif toujours-investi** (filtré − toujours = **+0,077**
pré-2021, +0,037 Max). La thèse « corriger l'exposition aux krachs » est donc **réelle**.

**MAIS la vitesse du filtre est décisive** — robustesse par épisode (ΔlogPerf réel médian ×100, w=10) :

| L | # ép. | total | leave-one-episode-out | sans 07-08 | **sans 2021-22** | part meilleur ép. | krach 2022 |
|---|---|---|---|---|---|---|---|
| **6** (hors zone) | 21 | +13,6 | **+6,5** | +11,4 | **+6,5 ✅** | **53 %** | 29 % ON |
| 9 (zone) | 18 | +3,7 | −4,2 | +3,4 | **−4,2 ❌** | 92 % | 43 % ON |
| 12 (zone) | 17 | +5,3 | −2,1 | +5,3 | **−2,1 ❌** | 81 % | 71 % ON |

- **Dans la zone préenregistrée (L=9-12, w=10-15)** : sans-2021-2022 **négatif**, leave-one-episode-out
  négatif, 81-92 % dans un seul épisode, **ΔMDD ≈ 0** (aucune protection : SMA lente, 71 % ON pendant le
  krach 2022). ⇒ **échoue les critères d'intégration §7.**
- **À L=6 (hors zone, bord de grille)** : sans-2021-2022 **+6,5**, leave-one-episode-out **+6,5**,
  meilleur épisode **53 %** (bien réparti), ΔSharpe Max +0,128 / pré-2021 +0,070, protection réelle
  (29 % ON pendant les krachs 2008 ET 2022). ⇒ **passe la barre de robustesse**, mais **au bord de la
  grille** (indéterminé vs L<6 : vrai plateau ou artefact de bord ?).

## 7. Confirmation du filtre rapide (préenregistrée) — PLATEAU ROBUSTE TROUVÉ

Grille exclusive L ∈ {4,5,6,7,8}, w ∈ {10,15}%, principale L=6/w=10, L=9 contrôle négatif, 25 bps
principal + 50 bps stress. `fichiers : trend-confirm.mts → trend-confirm-report.md`.

**Robustesse par L (w=10 %, 25 bps)** — médiane sur 21 pays :

| L | ΔSharpe Max | ΔMDD | sans-07/08 | **sans-21/22** | LOEO | meilleur ép. | post-lanc ΔSh | %amél. |
|---|---|---|---|---|---|---|---|---|
| 4 | +0,102 | −0,4 | +8,65 | +5,12 | +3,09 | 75 % | +0,086 | 100 % |
| 5 | +0,130 | −0,2 | +10,12 | +3,96 | +3,96 | 70 % | +0,102 | 100 % |
| **6** | **+0,128** | −0,0 | +11,42 | **+6,46** | +6,46 | **53 %** | +0,108 | 100 % |
| 7 | +0,110 | −0,0 | +9,42 | +3,35 | +3,35 | 67 % | +0,085 | 100 % |
| 8 | +0,082 | −0,0 | +4,62 | **−0,88** | −0,88 | 96 % | +0,048 | 100 % |
| 9 (ctrl) | +0,071 | −0,1 | +3,38 | **−4,23** | −4,23 | 92 % | +0,029 | 95 % |

**PLATEAU ROBUSTE sur L=4-7, cassure nette à L=8-9** (contrôle négatif). Sur L=5,6,7 : ΔCAGR>0,
ΔSharpe>0, **sans-2021-2022 positif** (+3,35 à +6,46), sans-2007-2008 positif, leave-one-episode-out
positif, **100 % pays améliorés**, ΔMDD ≈ 0, post-lancement positif. Confirmé à **w=15 %** (L6 sans-21/22
**+8,00**) et sous **stress 50 bps** (L6 ΔSharpe +0,117, sans-21/22 +4,84). Horizons tous positifs
(Max +0,128 · 20A +0,111 · 10A +0,183 · 5A +0,243). Diagnostic filtre : rdt ON ≈ +3,9 %/mois vs
OFF −3,5 %, retard de sortie ~1,6 mois, faible participation aux baisses.

**Nature = momentum de tendance sur l'énergie** (prime documentée), lookback RAPIDE (L≤7) qui sort vite
des krachs. La cassure propre à L=8 (filtre trop lent) est la signature d'un effet réel, pas d'un
artefact.

**Seule réserve** : 2021-2022 reste le plus gros épisode (53 % à L=6 ; 67-70 % à L=5/L=7). Mais le
bénéfice **survit à son retrait** (sans-21/22 positif partout sur L=4-7) → concentration réelle mais
**non disqualifiante**. Le pré-2021 est plus modeste (+0,070 vs +0,128 Max) ; la rotation monte
(~+17 pt/an, déjà nette de coûts). 8 des 9 barres passent proprement sur L=5,6,7 ; la 9ᵉ (concentration)
passe à la cellule principale L=6.

## 8. Verdict & décision

- **Signaux macro de régime mondial (canonique/A/B/C) : rejetés définitivement.**
- **Suivi de tendance, zone préenregistrée lente (L=9-12) : rejeté** (dominé par 2021-2022).
- **Suivi de tendance RAPIDE (L=4-7, w=10-15 %) : PLATEAU ROBUSTE** — passe la barre confirmatoire
  (multi-épisodes, sans-2021-2022 ≥ 0, sans-2007-2008 ≥ 0, LOEO ≥ 0, pas de dégradation de drawdown,
  post-lancement cohérent, stabilité pays/horizons/poids, robuste 50 bps).

⇒ Par la règle §7 : **ne pas modifier la production ; préparer un candidat expérimental séparé
`4q-energy-trend-rc1`** (filtre `SPDYENT>SMA_L`, L=6, w=10 %, prorata, bande unique 5 poches) **avec
concordance complète contre le moteur**, AVANT toute décision d'intégration. Socle production reste
`4q-standard-v2` inchangé. **Décision d'intégration = ultérieure**, sur pièce (le candidat + sa
concordance + une non-régression).

## 9. Fichiers

- `audit.mts` / `verify-signal.mts` — audit SPDYENT, conventions GT10/MXWO.
- `canonical.mts` → `canonical-report.md` — règle canonique `x>0∧y>0` (rejet).
- `variants.mts` → `variants-report.md` — 3 architectures macro A/B/C + épisodes (rejet).
- `trend.mts` → `trend-report.md` — suivi de tendance, exploration L∈{6,9,12} (découverte L=6).
- `trend-confirm.mts` → `trend-confirm-report.md` — **confirmation préenregistrée L∈{4..8} : PLATEAU
  ROBUSTE.** Test final.
- `study.mts`/`analyze.mts`/`oos.mts` — exploration élargie initiale (ramp/boombloc, différée).

## 10. Suite — candidat `4q-energy-trend-rc1` (construit, concordance complète)

Le plateau robuste a justifié un **candidat expérimental séparé** : `../4q-energy-trend-rc1/`
(spec figée L=6/w=10 %, prorata, bande unique 5 poches). **Concordance complète : 28 ✅ / 0 ❌**
(10 points + tests de frontière + golden figés US/FR/JP/BR), reproduit le moteur `backtestQuadrants`
au bit près (w=0 = v2 à ~1e-16), `tsc` vert. **Production intacte.** Protocole de comparaison
`v2 / rc1 / Browne` **préparé mais NON lancé** (`comparison-protocol.md`) — en attente de validation.

## 8. Fichiers

- `audit.mts` — audit SPDYENT + inventaire signal Monde ; `verify-signal.mts` — GT10/MXWO conventions.
- `canonical.mts` → `canonical-results.json`/`canonical-oos.json` ; `report.mts` → `canonical-report.md`
  (règle canonique `x>0∧y>0`, contrôles, sous-périodes, LOCO).
- `variants.mts` → `variants-report.md` — 3 architectures macro A/B/C + analyse par épisodes.
- `trend.mts` → `trend-report.md` — **suivi de tendance SPDYENT** (3 portefeuilles, diagnostic filtre,
  grille L×w, sous-périodes, sans-07-08/sans-21-22, épisodes). **Dernier test en date.**
- `study.mts`/`analyze.mts`/`oos.mts` — exploration élargie préalable (ramp/boombloc, différée).

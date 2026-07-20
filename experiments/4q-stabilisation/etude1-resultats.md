# Étude 1 — Stabilisation 4Q : résultats

> **Expérimental, hors socle.** Aucune modification du moteur, de l'interface, du tag
> `4q-standard-v1`, de l'Énergie ou de la comparaison Browne. Reproductible :
> `experiments/4q-stabilisation/study1.mts` (moteur figé + exécution custom pour la
> bande, `simulate(Standard)` vérifié identique au moteur : US 20A realCAGR 6,051 =
> 6,051, rotation 40,4 % ≈ 40,3 %). Panel = **22 pays**.

## Méthodes & définitions retenues

- **Bande `δ`** : à la clôture `t`, rotation-vers-cible `= ½·Σ|cible − détenu(dérivé)|` ;
  si `≤ δ` → **conserver les poids détenus** ; sinon → **réallouer intégralement**.
  Poids appliqués à `t+1`. `δ ∈ {1,2,3,5}` points de portefeuille. Global (pas
  d'optimisation pays par pays).
- **Hystérésis `h`** : état par axe sur la coordonnée — `POS` si `coord ≥ T+h`, `NEG`
  si `coord ≤ −(T+h)`, sinon **maintien** de l'état tant que `POS∧coord≥T` /
  `NEG∧coord≤−T`, sinon **NEUTRE** (bloc 25/25). Passage direct `+→−` autorisé (le seuil
  d'entrée prime). Rééquilibrage plein vers la cible filtrée. `h ∈ {5,10,20}`.
- Deux mesures de « fréquence » : **rotation annualisée** (volume échangé) et
  **part de mois avec réallocation effective** (turnover mensuel > 0,5 %).

## Constat mécanique central

En **stratégie dynamique**, la rotation mensuelle est **dominée par la correction de
dérive** (on ré-aligne un portefeuille sur une cible qui bouge peu et continûment),
**pas** par les bascules de signal. Conséquences vérifiées sur les 22 pays :

- la **bande** supprime surtout des **petites** réallocations → forte baisse du
  **nombre** de transactions, mais baisse **modérée** du **volume** (rotation), car les
  mois de forte dérive déclenchent toujours ;
- l'**hystérésis** ne vise que les bascules de signal (fraction infime du volume en
  dynamique) → réduction de rotation **négligeable** ;
- dans les deux cas, l'impact sur la performance réelle est **≈ nul** → les
  transactions rognées sont **économiquement du bruit**.

---

## 1. Standard vs bandes (dynamique · T=20 · 20A, médianes inter-pays)

| Variante | Rotation méd. | Rotation p90* | Nb réalloc méd. | ΔCAGR réel méd. | ΔSharpe méd. | ΔMDD réel méd. | % pays améliorés (rotation) |
|---|---|---|---|---|---|---|---|
| band δ1 | −2 % | −1 % | **−9 %** | 0,00 | 0,000 | 0,0 | 100 % |
| band δ2 | −7 % | −5 % | **−28 %** | −0,01 | −0,001 | 0,0 | 100 % |
| band δ3 | −14 % | −11 % | **−45 %** | 0,00 | 0,000 | 0,0 | 100 % |
| band δ5 | **−26 %** | −19 % | **−65 %** | 0,01 | 0,000 | 0,1 | 100 % |

\* p90 = pire décile (la réduction la plus faible). Lecture : même le pire décile
réduit la rotation ; aucune dégradation de perf/risque ; 0 pays dégradé de > 0,3 pt.

**Robustesse (dynamique · T=20 · Max/10A/5A)** : quasi identique (band δ5 = −26/−27 %
rotation, −65/−66 % réalloc partout ; ΔCAGR réel médian ≤ 0,02). Très stable.

## 2. Standard vs hystérésis (dynamique · T=20 · 20A, médianes)

| Variante | Rotation méd. | Nb réalloc méd. | ΔCAGR réel méd. | % pays améliorés |
|---|---|---|---|---|
| hyst h5 | 0 % | 0 % | 0,00 | 32 % |
| hyst h10 | 0 % | −1 % | 0,00 | 73 % |
| hyst h20 | −5 % | −2 % | 0,00 | 95 % |

**L'hystérésis est inopérante en dynamique** (rotation −0 à −5 %, nb réalloc ~0) : le
volume est porté par la dérive, pas par les bascules. À écarter pour la stratégie
dynamique.

## 3. Tableau d'admissibilité (horizon principal : dynamique · T=20 · 20A)

Seuils : rotation ≤ −30 % · nb réalloc ≤ −30 % · ΔCAGR réel ≥ −0,30 · ΔSharpe ≥ −0,05 ·
ΔMDD réel ≤ +2 pts.

| Variante | rot −30 % | réalloc −30 % | CAGR | Sharpe | MDD | **Admissible** |
|---|---|---|---|---|---|---|
| band δ1 | ✗ (−2) | ✗ (−9) | ✓ | ✓ | ✓ | **non** |
| band δ2 | ✗ (−7) | ✗ (−28) | ✓ | ✓ | ✓ | **non** |
| band δ3 | ✗ (−14) | ✓ (−45) | ✓ | ✓ | ✓ | **non** (rotation) |
| band δ5 | ✗ (−26) | ✓ (−65) | ✓ | ✓ | ✓ | **non** (rotation, à 4 pts) |
| hyst h5/10/20 | ✗ | ✗ | ✓ | ✓ | ✓ | **non** |

**⇒ Aucune variante n'est admissible à l'horizon principal.** Le seul critère bloquant
pour la bande est la **rotation‑volume −30 %** (plafonnée à −26 % à δ5) ; tous les
autres critères sont tenus, et dès δ3 le **nombre** de réallocations chute de 45 %.

**Sensibilité zone neutre** : à **T=50**, `band δ5` atteint −30 % rotation / −71 %
réalloc / ΔCAGR +0,03 → **admissible** (zone morte plus large ⇒ moins de dérive ⇒ bande
plus efficace). Mais T=50 n'est pas le réglage de classement (T=20).

## 4. Cas particuliers & dégradations extrêmes

- **Dynamique** : aucune dégradation extrême (ΔCAGR < −1 pt ou ΔMDD > +5 pts) sur
  aucune variante ni période. Dispersion très faible (pire décile ΔCAGR réel ≥ −0,16).
- **Contrôle binaire (T=20 · 20A)** : l'hystérésis y devient efficace sur la rotation
  (h20 : −41 % rotation) **mais** avec forte **dispersion** et **dégradations
  extrêmes** : `IN` ΔMDD **+5,2 pts** (h5/h10/h20), `DK` ΔCAGR **−1,8 pt** (h20) ; 8/22
  pays dégradés de > 0,3 pt à h20. → confirme que l'hystérésis **transforme le
  comportement économique** en binaire (elle fige des paris concentrés) : à écarter.
- La bande, en binaire, réduit surtout le **nombre** de trades (−25 à −67 %) et peu la
  rotation (−2 à −9 %), sans extrême.

## 5. Recommandation

**Aucune variante retenue en l'état** au regard des critères stricts (le seuil
rotation‑volume −30 % n'est atteint par aucune configuration dynamique à T=20).

**Seule candidate « Plus stable » défendable** : **bande, zone stable `δ = 2–3`,
dynamique**. Elle est :
- **simple** (« ne pas rééquilibrer si la transaction représente moins de δ % du
  portefeuille ») ;
- **robuste** entre pays (100 % améliorés, pire décile bénin) et entre périodes ;
- **peu sensible au paramètre** (comportement monotone, pas d'optimum isolé) ;
- **économiquement neutre** (ΔCAGR réel ≈ 0, Sharpe/MDD inchangés) ;
- efficace sur la **fréquence** des transactions (**−28 % à −45 %**), mais **pas** sur
  le **volume** de rotation (−7 à −14 %).

**Décision à trancher (toi)** : la valeur de la stabilisation dépend de l'objectif —
*réduire le nombre de trades* (la bande gagne nettement) vs *réduire le volume échangé*
(aucune variante n'atteint le seuil en dynamique). Si l'objectif est la fréquence, la
bande `δ=2–3` pourrait devenir une **option** « Plus stable » (jamais le défaut, sans
casser la non-régression v1). Sinon, **statu quo** : le Standard v1 est déjà proche de
l'optimal (sa rotation est majoritairement du bruit sans effet sur la performance).

**Hystérésis : écartée** (inopérante en dynamique ; en binaire, gains de rotation payés
par de la dispersion et des dégradations extrêmes).

## Ouverture (étude 2)

Le constat « rotation = dérive » suggère qu'une vraie réduction de **volume** passerait
par une **bande plus large** (δ > 5) ou une **combinaison bande + zone neutre plus
large**, à confronter aux critères. L'étude 2 (vitesse/accélération) reste distincte.

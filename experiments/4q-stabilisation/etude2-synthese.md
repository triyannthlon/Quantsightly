# Étude 2 — Bande de réallocation élargie : synthèse & recommandation

> **Question.** *Existe-t-il un δ GLOBAL robuste qui améliore le rendement-risque net de
> coûts, ou réduit fortement les coûts opérationnels sans dégrader le comportement
> économique du modèle ?*
>
> **Réponse : OUI.** Une **bande modérée `δ ≈ 5 points`** (plateau **δ=4-5**) est une
> amélioration **robuste** : elle divise par ~3 la **fréquence de réallocation** (mensuelle
> → ~trimestrielle) et améliore le **CAGR réel net de coûts** sur les 4 horizons, sans
> dégrader le drawdown. **⇒ Candidat sérieux pour `4q-standard-v2`.**
>
> Étude entièrement expérimentale, **moteur `four-quadrants/` NON modifié**.
> Reproductible : `study2-band.mts` (grille) + `study2-oos.mts` (hors-échantillon).

## 1. Ce qui a changé vs l'étude 1

L'étude 1 (ancien cadre « simplicité d'abord », δ∈{1,2,3,5}, sans coûts) avait conclu
« non-intégration ». Deux évolutions révèlent le signal :
1. **Grille δ élargie** `{0,1,2,3,4,5,6,8,10,12,15,20}` (δ=0 ≡ Standard v1, témoin) ;
2. **coûts de transaction intégrés au compounding** (`net = rp − coût·2·turnover`), car le
   bénéfice de la bande est **opérationnel**, pas du rendement brut.

**Règle bande** (inchangée) : garder les poids détenus (dérivés) si la rotation-vers-cible
`½·Σ|cible − détenu| ≤ δ` ; sinon réallouer plein. **Auto-vérifié** : `δ=0` reproduit le
moteur figé (US 20A : CAGR 6,051 = moteur ; rotation 40,4 % ≈ 40,3 %).

## 2. Dispositif
- **Panel** : 22 pays. **Grille** : δ (12 valeurs) × stratégie {dynamique, binaire} ×
  `T {0,20,50}` × horizons {Max, 20A, 10A, 5A} × coûts {0,10,25,50 bps}.
- **Métriques réelles** (déflatées CPI), nettes de coûts ; rotation annualisée ;
  **fréquence de réallocation** (mois avec turnover > 0,5 %) ; dispersion inter-pays,
  **pire décile**, **% pays améliorés**.

## 3. Résultats (dynamique, T=20)

### 3.1 Brut ≈ neutre ; net de coûts = robuste
Le gain **croît avec les coûts** et est **nul à 0 bps** — signature d'un bénéfice de **coût de
transaction**, pas d'alpha (δ=5, médiane ΔnetCAGR par horizon) :

| coût | Max | 20A | 10A | 5A |
|---|---|---|---|---|
| 0 bps | −0,01 | +0,01 | +0,02 | −0,00 |
| 10 bps | +0,02 | +0,03 | +0,05 | +0,02 |
| **25 bps** | **+0,05** | **+0,08** | **+0,08** | **+0,06** |
| 50 bps | +0,12 | +0,15 | +0,14 | +0,14 |

### 3.2 Réduction opérationnelle forte (le vrai prix)
Fréquence de réallocation (dynamique, réallocations/an) et rotation vs Standard :

| δ | réalloc/an (std→band) | réduction | rotation |
|---|---|---|---|
| 3 | 11,7 → 6,5 | **−45 %** | −13 % |
| **4** | 11,7 → 5,3 | **−56 %** | −21 % |
| **5** | 11,7 → 4,2 | **−65 %** | −26 % |
| 8 | 11,7 → 2,4 | −80 % | −43 % |

⇒ à δ=5, le portefeuille passe de **quasi mensuel à ~trimestriel**, à performance nette
égale ou meilleure. Bénéfice majeur pour un produit suivi **manuellement** par un débutant.

### 3.3 Plateau δ=4-5 ; au-delà, on court après le rendement
δ élevé (≥10) donne des médianes plus grosses **mais** dispersion et **pire décile** se
dégradent, MDD monte (+0,4 pt et p90 +1,5), le **5A devient négatif** → **pas robuste**.
δ=20 casse (Max net25 −0,04, MDD p90 +2,5). Le **comportement économique reste intact
uniquement sur le plateau δ=4-5** (ΔMDD ≈ 0).

## 4. Validation hors-échantillon (Phase 3)

- **A. Plateau contigu** (net 25) : δ=3,4,5 positifs sur les **4 horizons** (64-91 % pays
  améliorés). δ=8 : 5A s'effondre (+0,02, 50 %, pire décile −0,53). Centre robuste = **δ=4-5**.
- **B. Stabilité temporelle** : sur la **1ʳᵉ et la 2ᵉ moitié** du parcours de chaque pays,
  δ=4-5 restent **positifs** (δ4 : H1 +0,08 / H2 +0,05 ; δ5 : H1 +0,04 / H2 +0,07). Pas un
  artefact d'un épisode (2008/2020).
- **C. Leave-one-country-out** (δ=5, Max, net 25) : médiane panel **+0,054** ; en retirant
  **chacun** des 22 pays, la médiane reste dans **[+0,048 ; +0,059]** (signe jamais renversé).
  **86 %** de pays améliorés. Meilleurs CN/IN/AU, pires SG/MX/DK (mineurs ; DK = 21 mois, bruit).
  **⇒ non porté par quelques pays.**
- **D. Monotonie coûts** : δ=5 neutre à 0 bps, +0,05 à 25 bps, +0,14 à 50 bps → mécanisme
  = **économie de coûts de transaction** (le calcul le confirme : la baisse de rotation −26 %
  à 25 bps épargne ≈ +0,05 %/an, exactement le gain observé).

### Contrôles
- **Binaire** : la bande se comporte **sainement** (δ=4-6 net25 : +0,05 à +0,17, 91-100 %
  améliorés, MDD intact) — contrairement à l'hystérésis de l'étude 1 qui cassait le binaire.
  La réduction de fréquence sature vite (~−67 %) car le binaire trade déjà par sauts discrets.
- **Sensibilité `T`** (0 et 50) : le plateau δ=4-6 **tient** (gains net25 positifs, MDD intact).

## 5. Recommandation

**Adopter une bande de réallocation `δ = 5 points` comme candidat `4q-standard-v2`** (le
plateau δ=4-5 rend le choix exact non critique — c'est précisément la robustesse recherchée).
Justification statistique : gain net de coûts **positif et robuste** sur 4 horizons × 2
stratégies × 3 valeurs de `T`, **stable dans les deux moitiés** de l'historique, **invariant
au retrait de tout pays** (LOCO [+0,048 ; +0,059]), **86 % de pays améliorés**, **ΔMDD ≈ 0**,
et **neutre à coût nul** (aucun risque si les coûts sont négligeables).

Les **deux** critères produit de `v2` sont satisfaits : *(a)* amélioration du rendement-risque
net de coûts **et** *(b)* **forte réduction des coûts opérationnels** (−65 % de réallocations)
**sans dégrader le comportement économique**.

**Nature honnête du bénéfice** : ce n'est **pas** de l'alpha (brut ≈ 0) ; c'est de
l'**efficience de coûts + simplification opérationnelle**. Le gain de rendement net est modeste
(~+0,05 à +0,08 pt/an médian à 25 bps) ; le gain **certain et grand** est le passage de
~12 à ~4 réallocations/an à résultat net égal ou meilleur.

## 6. Suite (branche de la Phase 4)

Conformément au protocole : **la bande produit une amélioration robuste → on évalue un
candidat `4q-standard-v2`** (⇒ **pas** d'étude vitesse/accélération pour l'instant). Cette
adoption est une **modification du moteur** (couche de politique de réallocation `δ=5` après
la cible, avant `t→t+1`) et **N'A PAS été faite** durant l'étude. Étapes proposées, à valider :
1. implémenter la bande comme **couche pure** paramétrable (`δ`) dans `four-quadrants/`,
   `δ` par défaut = 5, exposée dans `settings` ;
2. **non-régression complète** + nouveau **golden** `4q-standard-v2` (comme v1), en documentant
   que v1 → v2 est une évolution **volontaire** (le golden change) ;
3. réglages UI éventuels (fréquence de réallocation affichée) — séparément.

Tant que cette adoption n'est pas décidée et implémentée, **`4q-standard-v1` reste le socle**.

## 7. Reproductibilité
- `study2-band.mts` — grille complète (1 056 agrégats, `study2-results.json`).
- `study2-oos.mts` — plateau + sous-périodes + leave-one-country-out + sensibilité coûts.
- Simulateur de bande = celui de l'étude 1 (`study1.mts`), vérifié `δ=0 ≡ moteur figé`.

# Étude 2 (bande élargie) — protocole & manifeste de reproductibilité

> Accompagne `etude2-synthese.md` (résultats + recommandation). Ici : la **définition
> exacte** de l'étude, les **versions de données** et la **procédure de reproduction**.
> Instantané des données : **2026-07-21** (séries de marché finissant 2026-06).

## 1. Question & règle testée

**Question.** Existe-t-il un δ GLOBAL robuste améliorant le rendement-risque net de coûts,
ou réduisant fortement les coûts opérationnels sans dégrader le comportement économique ?

**Règle « bande de réallocation »** (couche de politique d'exécution, appliquée APRÈS la cible
du mois `t`, AVANT `t+1`) :
1. `rotationVersCible = ½ · Σ|poidsCible − poidsDétenu(dérivés)|` ;
2. si `rotationVersCible ≤ δ` → conserver les poids détenus (aucun trade) ;
3. sinon → réallouer intégralement vers la cible ;
4. appliquer les poids retenus aux rendements de `t+1`.

`δ` en **points de portefeuille** (δ=5 ⇔ seuil de rotation 0,05). **δ=0 ≡ Standard v1.**
Les **coûts de transaction ne sont PAS dans la règle** : ils sont appliqués en post-traitement
à la rotation réellement exécutée (`net = rp − coût·2·turnover`).

## 2. Espace de paramètres (grille complète)

| Dimension | Valeurs |
|---|---|
| `δ` | 0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20 |
| stratégie | dynamique · binaire |
| `T` (zone neutre) | 0, 20, 50 |
| horizon | Max (histo complet) · 20A · 10A · 5A (fenêtres glissantes) |
| coûts | 0, 10, 25, 50 bps (sur volume brut = 2·turnover) |
| panel | 22 pays (`listQuadrantCountries`) |

Total balayé : 12·2·3·4 = 288 configurations × 22 pays, métriques × 4 coûts.

## 3. Métriques (réelles, déflatées CPI)
CAGR réel net · volatilité réelle · Sharpe réel (excès sur cash local) · max drawdown réel ·
durée sous l'eau · **rotation annualisée** · **fréquence de réallocation** (mois avec turnover
> 0,5 %, ×12) · dispersion inter-pays (Q1/Q3) · **pire décile** · **% pays améliorés** ·
stabilité inter-horizons.

## 4. Validation hors-échantillon (`study2-oos.mts`)
- **Plateau** : contiguïté du signe sur δ∈{3,4,5,6,8} × 4 horizons.
- **Sous-périodes** : 1ʳᵉ vs 2ᵉ moitié du parcours de chaque pays.
- **Leave-one-country-out** : médiane panel recalculée en retirant chaque pays (δ=5, Max, 25 bps).
- **Sensibilité coûts** : ΔnetCAGR(δ=5) à 0/10/25/50 bps.

## 5. Versions des données (empreintes)
Empreintes déterministes (FNV-1a) des 5 séries de perf par pays dans
`study2-fingerprints.csv` (country, devise, plage actions TR, n, plage CPI, hash combiné).
Elles détectent toute dérive des données entre deux exécutions. Exemples :

```
CA,CAD,1960-01-31→2026-06-30,798,1960-01-31→2026-07-31,9ba6fd8d
US → cf. CSV ; BR,BRL,1995-01-31→2026-06-30,378,…,1d8b243c
```

Séries GLOBALES (communes) : pétrole signal `CL1 comdty-XX-5-1` (1960→2026-06),
or `XAU Comdty-XX-5-1` (1971-08→2026-06). Base : `coredatadb` (LAN). Socle moteur : commit
`60ac363` (`4q-standard-v1`), couche bande **externe** (moteur non modifié pour l'étude).

## 6. Fichiers de l'étude (ce qui est conservé)
| Fichier | Rôle |
|---|---|
| `study2-band.mts` | Harnais principal (grille complète) → `study2-results.json` |
| `study2-oos.mts` | Plateau + sous-périodes + leave-one-country-out + sensibilité coûts |
| `study2-manifest.mts` | Génère empreintes + agrégats par pays |
| `study2-results.json` | Agrégats inter-pays (médiane/Q1/Q3/pire décile/%améliorés) par (stratégie,T,horizon,δ,coût) |
| `study2-percountry.csv` | **Agrégats PAR PAYS** (δ∈{0,3,4,5,6,8} × strat × T × horizon × coût), 6 336 lignes |
| `study2-fingerprints.csv` | Empreintes des données par pays |
| `etude2-synthese.md` | Résultats + recommandation (δ=5) |
| `etude2-manifest.md` | Ce document |

**Sorties brutes** (chemins mensuels, ~100k backtests) : **non commitées** car **entièrement
reproductibles** par les scripts ci-dessus + empreintes. On conserve les agrégats utiles.

## 7. Reproduction
```bash
# depuis C:/UDE/Apps/quantsightly (LAN coredatadb via .env)
pnpm exec tsx experiments/4q-stabilisation/study2-band.mts      # grille + results.json
pnpm exec tsx experiments/4q-stabilisation/study2-oos.mts       # hors-échantillon
pnpm exec tsx experiments/4q-stabilisation/study2-manifest.mts  # empreintes + CSV par pays
```
Auto-vérif intégrée : chaque harnais confirme `δ=0 ≡ moteur figé` (US 20A). Résultats
attendus détaillés dans `etude2-synthese.md`.

# Rôle de l'actif — matrice par régime

> **Document conceptuel verrouillé — Phase 0, Chantier 5 (2026-06-24).**
> Définit le **rôle** (Fragile / Robuste / Protecteur) de chaque sous-catégorie d'actif dans chacun des 4 quadrants macro.
>
> Principe fondateur : **la fragilité n'est pas une propriété fixe d'un actif** — elle dépend du régime. Un bond 10Y est Protecteur en contraction déflationniste et Très Fragile en stagflation. Une action large est Protectrice en boom déflationniste et Très Fragile en stagflation.

---

## Sous-catégories

Les 3 catégories Gave (Outils / Rareté / Contrats, voir `glossaire.md`) sont **trop grossières** pour porter directement le rôle, car :

- Au sein des **Contrats**, cash et bonds longs ont des comportements opposés (cash robuste partout, bonds longs très fragiles en stagflation).
- Au sein des **Outils**, actions large/croissance et actions value/énergie réagissent à l'opposé en régime inflationniste.

On opère donc sur **7 sous-catégories** :

| Code | Sous-catégorie | Exemples |
|---|---|---|
| **OUT-broad** | Outils — actions large/croissance | S&P 500, CAC 40, MSCI World, ETF actions broad |
| **OUT-value** | Outils — actions value / cycliques / énergie | XLE, XLF, actions énergie, financières, value |
| **RAR-or** | Rareté — or et métaux précieux | XAU, GLD, SLV |
| **RAR-mp** | Rareté — matières premières broad | DBC, GSG, pétrole physique, métaux industriels |
| **RAR-crypto** | Rareté — cryptomonnaies | BTC, ETH (hors stablecoins, qui sont CON-cash) |
| **CON-long** | Contrats — bonds longs | TLT (20Y), bonds 10Y, OAT 10Y, JGB 10Y |
| **CON-cash** | Contrats — cash et bonds courts | Comptes courants, livrets, XEON, BIL, dépôts, USDC/USDT |

L'agrégation en 3 catégories Gave reste possible pour les vues simplifiées du mode débutant. Le **moteur de diagnostic** (Chantier 6) travaille sur les 7 sous-catégories.

---

## Mapping AssetType Quantsightly → sous-catégorie

| AssetType (catalogue Quantsightly) | Sous-catégorie par défaut | Override possible |
|---|---|---|
| `stock` | OUT-broad | Si tag secteur énergie/finance → OUT-value |
| `index` | OUT-broad | Si indice sectoriel énergie/value → OUT-value |
| `etf` | dépend du sous-jacent (voir Chantier 3) | Mapping symbole par symbole |
| `bond` | CON-long (par défaut 10Y) | Si maturité courte → CON-cash |
| `currency` | CON-cash | Toujours |
| `crypto` | RAR-crypto | Stablecoins (USDC, USDT) → CON-cash (verrouillé Chantier 3) |

---

## Échelle du rôle

- **Score continu interne** : `[-1, +1]`
  - `-1` = très fragile (perd lourdement)
  - `0` = neutre/robuste (préserve)
  - `+1` = très protecteur (gagne quand les autres perdent)

- **Discrétisation pour affichage débutant** (3 niveaux) :
  ```
  score ≤ -0.4 → 🔴 Fragile
  -0.4 < score < +0.4 → 🟡 Robuste
  score ≥ +0.4 → 🟢 Protecteur
  ```

- **Nuance mode avancé** (5 niveaux) :
  ```
  |score| ≥ 0.7 → "Très Fragile" / "Très Protecteur"
  ```

---

## La matrice 7 × 4

Légende : 🔴 Fragile · 🟡 Robuste · 🟢 Protecteur · 🔴🔴 / 🟢🟢 = extrêmes (|score| ≥ 0.7).

| Sous-catégorie | 🟢 Boom déflationniste | 🟠 Boom inflationniste | 🔴 Stagflation | 🔵 Contraction déflationniste |
|---|---|---|---|---|
| **OUT-broad** | 🟢 Protecteur (+0.8) | 🔴 Fragile (-0.4) | 🔴🔴 Très Fragile (-0.9) | 🔴 Fragile (-0.7) |
| **OUT-value** | 🟡 Robuste (-0.2) | 🟢🟢 Très Protecteur (+0.9) | 🟢 Protecteur (+0.5) | 🔴 Fragile (-0.6) |
| **RAR-or** | 🟡 Robuste (-0.1) | 🟢🟢 Très Protecteur (+0.9) | 🟢 Protecteur (+0.7) | 🟡 Robuste (+0.1) |
| **RAR-mp** | 🔴 Fragile (-0.3) | 🟢 Protecteur (+0.8) | 🟡 Robuste (+0.2) | 🔴 Fragile (-0.6) |
| **RAR-crypto** | 🟢 Protecteur (+0.5) | 🟡 Robuste (+0.3) | 🔴 Fragile (-0.5) | 🔴 Fragile (-0.7) |
| **CON-long** | 🟢 Protecteur (+0.6) | 🔴🔴 Très Fragile (-0.9) | 🔴🔴 Très Fragile (-0.8) | 🟢🟢 Très Protecteur (+0.9) |
| **CON-cash** | 🟡 Robuste (-0.1) | 🔴 Fragile (-0.4) | 🟢 Protecteur (+0.5) | 🟢 Protecteur (+0.4) |

---

## Cohérence avec le Portefeuille Permanent de Browne

Browne dit *un actif par quadrant*. La matrice confirme cette structure :

| Quadrant | Gagnant Browne | Top score de la matrice |
|---|---|---|
| 🟢 Boom déflationniste | Actions | OUT-broad (+0.8) ✓ |
| 🟠 Boom inflationniste | Or | RAR-or (+0.9), OUT-value (+0.9) ✓ |
| 🔴 Stagflation | Cash + énergie | RAR-or (+0.7), OUT-value (+0.5), CON-cash (+0.5) ✓ |
| 🔵 Contraction déflationniste | Bonds longs | CON-long (+0.9) ✓ |

---

## Sortie du moteur (à consommer par le Chantier 6)

Pour un portefeuille donné et un quadrant courant `q` :

```
poids[c]    = somme des montants en sous-catégorie c / valeur totale du portefeuille
role[c]     = matrice[c][q]                          // score [-1, +1]
diag_score  = somme sur c de (poids[c] × role[c])    // score global [-1, +1]
```

Le `diag_score` est l'indicateur synthétique de cohérence portefeuille / régime. Il alimentera les verdicts (Chantier 7).

---

## Cellules signalées comme incertaines

5 cellules sont basées sur des hypothèses raisonnables mais non strictement validées par le livre Gave :

1. **RAR-crypto** en boom déflationniste (+0.5) — Gave ne traite pas la crypto. Hypothèse : suit la liquidité comme les actions growth (cycle 2020-2021).
2. **RAR-crypto** en contraction déflationniste (-0.7) — basé sur 2022 (BTC -75% en chute de liquidité).
3. **OUT-value en stagflation (+0.5)** — énergie résiste mais finance/cyclique souffrent. Moyenne.
4. **RAR-mp en stagflation (+0.2)** — pétrole monte, métaux industriels chutent. Moyenne nulle plausible.
5. **CON-cash en boom inflationniste (-0.4)** — érosion par inflation, taux courts compensent partiellement.

À reconfirmer auprès de Charles/Didier au prochain échange opportun. Sans bloquer.

---

## Évolutions à prévoir (hors périmètre Chantier 5)

- **Sous-classification ETF par symbole** (Chantier 3 a tracé le besoin) : table dédiée `etf_classification` à créer dans la DB Quantsightly au moment de l'implémentation.
- **Tag secteur sur stocks/indices** pour détecter automatiquement OUT-value (secteur énergie/finance/matériaux) vs OUT-broad. La base coredata expose déjà un `sector` (smallint, FK vers `sectors`) sur ses séries — à voir si on peut s'en servir pour les actions individuelles côté Quantsightly.
- **Maturité des bonds** : si l'application supporte un jour les bonds < 5Y, il faudra une distinction CON-long vs CON-cash basée sur la maturité.

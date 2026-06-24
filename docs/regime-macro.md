# Régime macro — méthode Gave / Darcet

> **Document conceptuel verrouillé — Phase 0, Chantier 4 (2026-06-24).**
> Méthode de détection du quadrant macro courant, telle que formalisée par Didier Darcet (transmise à Yann directement).
>
> Source des données : base `coredatadb` (PostgreSQL, env `CODEDATA_DATABASE_URL`).
> Granularité : **mensuelle** (fin de mois), imposée par la base. Profondeur : ~66 ans (1960-01-31 → courant), 797 points par série.

---

## Les 2 axes

### Axe Croissance (signal énergie)

**Ratio** :

```
Ratio_énergie(t) = Index_actions_local(t) / Pétrole_local(t)
```

**Signal** : ratio courant **vs** sa moyenne mobile 7 ans (MM7Y, soit 84 points mensuels).

- Ratio **> MM7Y** → **accélération** économique
- Ratio **< MM7Y** → **ralentissement** économique

### Axe Inflation (signal monnaie)

**Ratio** :

```
Ratio_inflation(t) = Bond10Y_local_prix(t) / Or_local(t)
```

**Signal** : ratio courant vs MM7Y.

- Ratio **> MM7Y** → **désinflation** (les bonds dominent l'or)
- Ratio **< MM7Y** → **inflation** (l'or domine les bonds)

---

## Les 4 quadrants

| Croissance \ Inflation | Désinflation (bonds/or > MM7Y) | Inflation (bonds/or < MM7Y) |
|---|---|---|
| **Accélération** (actions/pétrole > MM7Y) | 🟢 **Boom déflationniste** | 🟠 **Boom inflationniste** |
| **Ralentissement** (actions/pétrole < MM7Y) | 🔵 **Contraction déflationniste** | 🔴 **Stagflation** |

Définitions complètes des 4 quadrants : voir `glossaire.md` entrées #10-13.

---

## Conversion devise — flag `reverse`

Les séries pétrole (`CL1`) et or (`XAU`) sont cotées en USD. Pour les exprimer dans la devise locale d'une zone, on multiplie par le taux `fx_locale_par_USD` calculé à partir du Spot brut :

| `reverse` (table `countries`) | Conversion |
|---|---|
| `false` (JPY, KRW, ...) | `fx_locale_par_USD = value` (la cote est déjà "X locale par 1 USD") |
| `true` (EUR, GBP, ...) | `fx_locale_par_USD = 1 / value` (la cote est "USD par 1 locale", on inverse) |

```
Pétrole_local(t) = WTI_usd(t) × fx_locale_par_USD(t)
Or_local(t)      = XAU_usd(t) × fx_locale_par_USD(t)
```

Vérifié sur données réelles (2026-05-31) : Spot EUR = 1.1659 (EUR/USD, `reverse=true`), Spot JPY = 159.27 (USD/JPY, `reverse=false`).

---

## Contrat de séries

Toutes les séries sont stockées dans `economic_data` (3 colonnes : `serie_id`, `date`, `value`), avec les `serie_id` ci-dessous identifiés dans `economic_series` :

### Séries communes (USD natif)

| Variable | `serie_id` | `class` | `type` | Note |
|---|---|---|---|---|
| Pétrole WTI | `CL1 comdty-XX-5-1` | 5 (commodity) | 1 (prix) | Generic 1st 'CL' Future, USD/baril |
| Or spot | `XAU Comdty-XX-5-1` | 5 (commodity) | 1 (prix) | Gold Spot, USD/oz |

### Par zone

| Zone | Index actions (prix nu) | Bond 10Y (prix nu) | Spot FX |
|---|---|---|---|
| 🇺🇸 USA | `SPX Index-US-1-1` | *(prix à calculer à partir du yield `GT10 Govt-US-4-3`)* | — |
| 🇫🇷 France | `CAC Index-FR-1-1` | *(prix à calculer à partir de `GTFRF10Y Govt-FR-4-3`)* | `EUR curncy-FR-2-7` (reverse=t) |
| 🇩🇪 Allemagne | `DAXK Index-DE-1-1` | *(prix à calculer à partir de `GDBR10 Index-DE-4-3`)* | `EUR curncy-DE-2-7` (reverse=t) |
| 🇯🇵 Japon | `TPX Index-JP-1-1` | *(prix à calculer à partir de `GJGB10 Index-JP-4-3`)* | `JPY curncy-JP-2-7` (reverse=f) |
| 🇬🇧 UK | `UKX Index-GB-1-1` | *(prix à calculer à partir de `GUKG10 Index-GB-4-3`)* | `GBP curncy-GB-2-7` (reverse=t) |

**Indices boursiers** : `type=1` = prix nu (pas total return), conforme à l'exigence Didier *"séries de prix, pas le total return"*.

---

## Point en suspens — Prix nu des bonds 10Y

Décision Yann (2026-06-24) : on utilise **les prix nus** pour les bonds 10Y, **pas** les indices total return (`type=2`).

Or la base `coredatadb` ne stocke pas de `type=1` (prix) pour les bonds — seulement :
- `type=2` (prix total return)
- `type=3` (yield)
- `type=4` (taux réel)

**Conséquence** : le prix nu sera **calculé à partir du yield** au moment de l'implémentation (Sprint suivant). Formule de conversion à figer ultérieurement (typiquement approximation par duration : `P ≈ par × exp(-D × (y - y_réf))` avec `D ≈ 7-9` ans pour un 10Y, ou `(1+y_ref)/(1+y)^D`). Pas dans le périmètre de ce Chantier 4.

---

## Sortie du moteur

Pour chaque zone et chaque date `t` :

```
{
  ratio_energie:      number,        // Ratio_énergie(t)
  mm7y_energie:       number,        // MM7Y(Ratio_énergie) à t
  ecart_energie_pct:  number,        // (ratio - mm7y) / mm7y × 100
  ratio_inflation:    number,
  mm7y_inflation:     number,
  ecart_inflation_pct: number,
  quadrant: "boom_def" | "boom_inflation" | "stagflation" | "contraction_def"
}
```

La page produit affichera :
- **Quadrant courant** (verdict binaire) → utilisé pour les verdicts du diagnostic
- **Coordonnées continues** `(écart_énergie, écart_inflation)` → trajectoire historique dans le plan des 4 quadrants (visualisation)

---

## Périmètre MVP

- **Sprint 1 d'implémentation** : USA seul. Pas de FX, formules simplifiées. Quadrant US affiché comme "régime macro de référence".
- **Sprint 2** : Europe (France/Allemagne) + Japon. Sélecteur de zone dans le user setting (selon pays utilisateur).

---

## Préalable technique au code

`src/lib/coredata-db.ts` n'est pas adapté au schéma actuel de `coredatadb` (Yann l'a confirmé — code non encore migré sur la nouvelle base, pas un bug à proprement parler). À refaire avant tout code Chantier 4. Travail à faire :

- Accéder à `economic_series` via les colonnes réelles (`id`, `bbg_ticker`, `country_iso`, `currency`, `class` (smallint), `type` (smallint), `sector` (smallint), `ticker_name`)
- Joindre `countries`, `classes`, `types`, `sectors` pour les labels FR/EN
- Lire `economic_data` par `serie_id` (déjà OK dans le code actuel)
- Exposer le flag `reverse` de `countries` pour la conversion forex

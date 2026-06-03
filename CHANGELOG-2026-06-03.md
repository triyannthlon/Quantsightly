# Changelog — 3 juin 2026

## Vue d'ensemble

Session de développement centrée sur l'**AssetPanel** (composant partagé graphique + KPI) et le **dashboard** (grille de cards DnD avec persistance par utilisateur).

---

## 1. Toast notifications sur les favoris

**Fichier :** `src/hooks/watchlist/use-watchlist.ts`

Ajout de notifications sonner lors du toggle favori depuis le screener :
- Étoile activée → `toast.success("Ajouté au dashboard principal")`
- Étoile désactivée → `toast.info("Retiré du dashboard principal")`

Le nom de l'actif apparaît en description. La notification est déclenchée immédiatement (mise à jour optimiste).

---

## 2. Composant AssetPanel — structure (Étape 1)

**Fichier :** `src/components/custom/asset-panel/asset-panel.tsx`

Composant partagé entre le screener et le dashboard, avec deux modes :

| Mode | Contexte | Layout |
|------|----------|--------|
| `inline` | Accordion dans la table screener | Pleine largeur, 5 KPI en ligne, graphique 220px |
| `card` | Grille dashboard | Card shadcn, 4 KPI en grille 2×2, graphique 160px |

**Sous-composants internes :**
- `KpiGrid` — grille de cards KPI (valeur en haut `text-[18px] bold`, label en bas `text-[11px]`, fond `bg-card border shadow-xs`)
- `PeriodSelector` — boutons 1M / 3M / 6M / 1A / 3A / 5A / MAX
- `PriceChart` — graphique recharts (voir Étape 5)

---

## 3. Intégration screener — accordion (Étape 2)

**Fichiers :** `watchlist-table.tsx`, `watchlist-row.tsx`

- Chaque ligne de la table est rendue cliquable (cursor-pointer)
- Un clic ouvre/ferme l'`AssetPanel` en mode `inline` sous la ligne
- Un seul accordion ouvert à la fois (état `expandedId`)
- Le menu dropdown (⋮) stoppe la propagation pour ne pas déclencher l'accordion
- Suppression d'un item → ferme l'accordion si cet item était ouvert
- Bouton **chevron ↑** pour fermer (plus élégant que la croix)

---

## 4. Dashboard — grille de cards (Étape 3)

**Fichiers :** `dashboard-form.tsx`, `use-dashboard-favorites.ts`

**Hook `useDashboardFavorites` :**
- Fetch les 5 types de watchlists en parallèle (`Promise.all`)
- Filtre les items `isFavorite: true`
- Résout les métadonnées catalogue en un seul appel
- Expose `removeFavorite` (retrait optimiste + toast)

**Dashboard :**
- Header avec compteur d'actifs suivis
- État chargement : skeletons animés
- État vide : message + boutons CTA vers chaque screener
- Grille responsive : 1 colonne mobile / 2 tablette / 3 large écran

**Card :** icône type d'actif (couleur par type), nom, symbole, prix, 1J, étoile dorée pour retirer.

---

## 5. Design KPI — style "dashboard" (avant Étape 4)

Refonte visuelle des cards KPI :

| Avant | Après |
|-------|-------|
| Label en haut (`text-[10px]`), valeur en bas (`text-sm`) | **Valeur en haut (`text-[18px] bold`)**, label en bas (`text-[11px]`) |
| `bg-muted/50` sans bordure | `bg-card border border-border/60 shadow-xs` |
| Aspect tableau (gap-px bg-border) | Vraies cards arrondies avec espacement |

Remplacement de la croix × par un **chevron ↑** pour fermer l'accordion.

---

## 6. KPI réels — dépendants de la période (Étape 4)

**Fichiers :** `src/lib/yann/analytics/metrics.ts`, `use-asset-panel-metrics.ts`

**5 nouvelles fonctions dans `metrics.ts` (via `computePanelMetrics`) :**

| Métrique | Formule |
|----------|---------|
| Perf. annualisée | CAGR sur barres réelles (non-synthetic) |
| Volatilité ann. | σ(log-rendements) × √(252 ou 365) |
| Max Drawdown | Creux pic-à-creux maximum sur `adjusted_close` |
| DD courant | Distance depuis le dernier pic historique |
| Sharpe | Perf. ann. / Vol. ann. (rf = 0) |

**Hook `useAssetPanelMetrics` :**
- Fetch + normalise la série via `fetchHistory` + `buildNormalizedSeries`
- Même pattern de polling que `useWatchlistRows` (retry 12× / 5s)
- Renvoie la `NormalizedSeries` complète (réutilisée par le graphique)

**Clé : les KPI sont recalculés à chaque changement de période** — `useMemo` sur `filterByPeriod(series, period)` dans le composant. Les métriques reflètent exactement la fenêtre temporelle affichée.

---

## 7. Graphique des prix recharts (Étape 5)

**Package :** `pnpm add recharts`

**Composant `PriceChart` (interne à `asset-panel.tsx`) :**
- Réutilise la `NormalizedSeries` déjà chargée pour les KPI (pas de re-fetch)
- `filterByPeriod(series, period)` → filtre par date selon la période sélectionnée
- `decimate(bars, max=600)` → sous-échantillonnage pour les longues séries
- Couleur dynamique : **vert** si dernier prix > premier, **rouge** sinon
- `AreaChart` recharts avec gradient, tooltip personnalisé (date FR + prix)
- `isAnimationActive={false}` pour les changements de période instantanés

---

## 8. Drag-and-drop dashboard + persistance (Étape DnD)

**Packages :** `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

### Schéma Prisma
```prisma
model Users {
  dashboardLayout String?  // JSON : ["itemId1", "itemId2", ...]
}
```
Migration : `20260603151626_add_dashboard_layout`

### API
- `GET  /api/me/dashboard/layout` → retourne l'ordre sauvegardé
- `PATCH /api/me/dashboard/layout` → `{ layout: string[] }` → sauvegarde

### Frontend
- `useDashboardFavorites` charge le layout en parallèle des watchlists, trie les favoris selon l'ordre sauvegardé
- `reorder(newFavorites)` : mise à jour locale immédiate + sauvegarde déboncée 800ms
- Composant `SortableCard` : wraps `AssetPanel` avec `useSortable` de dnd-kit
- Activation du drag après 8px (évite les clics accidentels)
- Poignée `GripVertical` discrète dans le header, visible au hover
- Nouveaux favoris : ajoutés à la fin. Favoris retirés : ignorés au tri.

---

## 9. Prix et perf 1J dans les cards

Prix et performance 1J calculés depuis la série complète (indépendants de la période sélectionnée) :

```
lastPrice = series.bars[last].close
ret1d     = weekdayReturns(series).ret1d   // ou cryptoReturns pour CC
```

**Layout header revu :**
```
[Icon] Nom                          [★]
       Symbole
       450,91 $    1J +1.45 %
       (text-2xl)  (text-base, coloré)
```

---

## 10. Lisibilité colonnes watchlist

**Fichiers :** `stock/crypto/etf/index/forex-columns.tsx`

Badges de variation (1J, 1S, 1M, YTD) et colonnes 52W :
- `text-xs` → `text-sm` sur les valeurs numériques
- Icônes TrendingUp/Down/Minus : `h-3 w-3` → `h-3.5 w-3.5`

---

## Fichiers créés

| Fichier | Rôle |
|---------|------|
| `src/components/custom/asset-panel/asset-panel.tsx` | Composant principal (inline + card) |
| `src/hooks/watchlist/use-asset-panel-metrics.ts` | Fetch + normalise + retourne série |
| `src/hooks/watchlist/use-dashboard-favorites.ts` | Agrège favoris multi-types + DnD |
| `src/app/api/me/dashboard/layout/route.ts` | GET/PATCH layout dashboard |
| `src/app/(dev)/asset-panel-demo/page.tsx` | Page de démo (dev only) |
| `prisma/migrations/…_add_dashboard_layout/` | Migration colonne dashboardLayout |

## Commit

```
8df4c94  feat: dashboard avec AssetPanel, graphiques, KPI, DnD et persistance
```

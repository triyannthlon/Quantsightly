# Changelog — 15 juin 2026

## Vue d'ensemble

Session de retour de vacances. Travail centré sur la **cohérence d'expérience utilisateur** et la **pédagogie pour le public mixte débutant / confirmé** (cible Université de l'Épargne).

Sept incréments livrés, tous rétro-compatibles et sans régression sur l'existant.

---

## 1. Modale de recherche — effet "verre dépoli" (FrostedDialogContent)

**Problème :** Sur le screener (ex : ETF), la modale de recherche se confondait visuellement avec le dashboard en arrière-plan. Le `DialogContent` shadcn utilise `bg-background`, identique à la page en dark mode. L'overlay à `bg-black/50` ne suffisait pas à séparer les deux plans.

**Solution :** création d'un wrapper custom qui n'altère pas le composant shadcn (préserve le chemin de mise à jour `pnpm dlx shadcn@latest add dialog`).

**Fichiers :**

- ✨ `src/components/custom/ui/frosted-dialog.tsx` — nouveau, expose `FrostedDialogContent` avec :
  - Overlay `bg-black/70 backdrop-blur-sm` (effet verre dépoli)
  - Contenu `bg-popover` (plus clair que la page)
  - `shadow-2xl`
- 🔧 `src/components/custom/screener/asset-search-modal.tsx` — bascule de `DialogContent` vers `FrostedDialogContent`
- ✅ `src/components/ui/dialog.tsx` — **intact**

**Résultat :** la modale se détache nettement de la page, look fintech moderne.

---

## 2. Période synchronisée — Dashboard

**Problème :** chaque card du dashboard maintenait son propre état `period`. Résultat : dashboard incohérent avec des cards en "3M", d'autres en "1A", d'autres en "YTD".

**Solution :** pattern controlled/uncontrolled sur `AssetPanel`. Le dashboard remonte l'état au niveau de la grille.

**Fichiers :**

- 🔧 `src/components/custom/asset-panel/asset-panel.tsx` :
  - Export du type `Period`
  - Ajout des props optionnelles `period?` et `onPeriodChangeAction?`
  - `AssetPanelCard` utilise le pattern controlled/uncontrolled
- 🔧 `src/components/custom/forms/dashboard/dashboard-form.tsx` :
  - `useState<Period>` partagé par toutes les `SortableCard`

**Résultat :** changer la période sur une card affecte toutes les cards.

---

## 3. Période synchronisée — Screener inline

**Problème :** dans l'accordion screener, ouvrir Apple en "3M" puis fermer et ouvrir Microsoft repartait en "1A". Choix perdu.

**Solution :** même pattern controlled/uncontrolled appliqué à `AssetPanelInline`.

**Fichiers :**

- 🔧 `src/components/custom/asset-panel/asset-panel.tsx` — `AssetPanelInline` accepte aussi le pattern
- 🔧 `src/components/custom/watchlist/watchlist-table.tsx` — état partagé entre toutes les lignes de la table

**Résultat :** la période est conservée quand on change d'actif dans le même screener.

---

## 4. Période globale — Context partagé + localStorage

**Problème (continuation logique) :** la période ne se propageait toujours pas entre les différents screeners (crypto → ETF) ni entre dashboard et screener. Et elle se réinitialisait au refresh.

**Solution :** PeriodContext monté dans le layout `(admin)`. Source unique de vérité pour toute l'app authentifiée. Persistance localStorage.

**Fichiers :**

- ✨ `src/hooks/period/period-context.tsx` — nouveau Context + `PeriodProvider` + hook `usePeriod()`
  - Hydratation depuis `localStorage['quantsightly:period']` après mount (évite hydration mismatch)
  - Persistance silencieuse à chaque setPeriod
  - Fallback gracieux si localStorage indisponible (mode privé, quota dépassé)
- 🔧 `src/app/(admin)/layout.tsx` — wrap avec `<PeriodProvider>`
- 🔧 `src/components/custom/watchlist/watchlist-table.tsx` — `useState` local remplacé par `usePeriod()`
- 🔧 `src/components/custom/forms/dashboard/dashboard-form.tsx` — idem

**Résultat :** la période est désormais partagée par dashboard + tous les screeners + survit aux rechargements navigateur.

---

## 5. Unification des options de période

**Problème :** le dashboard avait 6 boutons (1M, 3M, 6M, YTD, 1A, MAX) tandis que le screener inline en avait 8 (avec 3A et 5A). Incohérence.

**Solution :** suppression de `PERIODS_COMPACT`, utilisation de `PERIODS_FULL` partout (8 boutons), ajout d'une prop `size="compact"` sur `PeriodSelector` pour les cards dashboard (boutons légèrement réduits afin de tenir dans la largeur).

**Fichier :**

- 🔧 `src/components/custom/asset-panel/asset-panel.tsx` :
  - Constante `PERIODS_COMPACT` supprimée
  - `PeriodSelector` accepte `size?: "default" | "compact"`
  - En mode compact : `h-7 min-w-[2.25rem] px-1.5 text-xs` (au lieu de `h-8 min-w-[3rem] px-3 text-sm`)
  - `AssetPanelCard` passe `size="compact"`

**Résultat :** 8 options identiques partout, lisibles dans les cards dashboard étroites.

---

## 6. Transitions fluides au changement de période

**Problème :** les chiffres KPI flashaient instantanément, le graphique se redessinait sans transition. Effet saccadé, contraste fort avec la pill du sélecteur déjà animée par Framer Motion.

**Solution :** deux interventions surgicales dans `asset-panel.tsx`.

**Changements :**

- Import `AnimatePresence` ajouté
- `<Area>` du graphique principal : `isAnimationActive={true} animationDuration={500} animationEasing="ease-out"` → la ligne se redessine progressivement (morphing entre périodes)
- Grilles KPI (modes `inline` et `card`) : wrappées dans `<AnimatePresence mode="wait">` avec `<motion.div key={period}>` → cross-fade `opacity + y` de 180ms à chaque changement de période

**Résultat :** changement de période donne une sensation fluide et cohérente. La pill, les KPI et le chart s'animent simultanément en ~500ms.

---

## 7. Tooltips pédagogiques — KPI

**Problème :** l'icône `(i)` en haut à droite de chaque card KPI était purement décorative (`cursor-default`). Aucune explication des métriques, alors que la cible inclut des débutants.

**Solution :** dictionnaire pédagogique centralisé + tooltip shadcn à 2 niveaux d'information.

**Convention pédagogique :**

- **Ligne 1 — `definition`** : ce que c'est (formulation accessible débutant)
- **Ligne 2 — `interpretation`** : comment lire la valeur (utile au confirmé pour situer)

**Fichiers :**

- ✨ `src/components/custom/asset-panel/kpi-tooltips.ts` — dictionnaire `KPI_TOOLTIPS` indexé par label, 8 entrées :
  - Perf. cumulée · Perf. annualisée · Volatilité ann.
  - Max DD · DD courant · Sharpe
  - Jours haussiers · Range période (modes forex)
- 🔧 `src/components/custom/asset-panel/metric-card.tsx` :
  - L'icône `<Info>` devient un `<button>` interactif si une entrée existe pour le label
  - Tooltip shadcn avec délai 300ms, `max-w-xs`, `align="end"`
  - Accessibilité : `aria-label`, focus ring, `cursor-help`
  - Fallback gracieux si pas d'entrée (icône inerte conservée)

**Fix de contraste :** la ligne d'interprétation utilisait `text-muted-foreground` invisible sur le fond clair du tooltip shadcn (qui inverse les couleurs : `bg-foreground text-background`). Remplacé par `text-background/70` qui adapte correctement dans les deux thèmes.

---

## 8. Tooltips pédagogiques — Colonnes du screener

**Problème (extension logique du #7) :** les en-têtes de colonnes calculées (1J, YTD, Δ sommet 52S, etc.) n'avaient aucune explication.

**Solution :** même pattern que les KPI — dictionnaire centralisé + helper local dans le composant de table.

**Fichiers :**

- ✨ `src/components/custom/watchlist/column-tooltips.ts` — dictionnaire `COLUMN_TOOLTIPS`, 6 entrées :
  - 6 Mois · 1J · YTD
  - Δ sommet 52S · Δ Sommet 52S / Δ ATH (crypto) · Bas/Haut 52S (forex)
  - Les colonnes purement identitaires (Nom, Pays, Devise, Dernier Prix…) restent sans tooltip
- 🔧 `src/components/custom/watchlist/watchlist-table.tsx` :
  - Nouveau composant interne `<ColumnInfo label={...} />`
  - Intégré dans les **deux branches** du rendu d'en-tête (sortable + non sortable)
  - `onClick={stopPropagation}` sur le bouton tooltip pour ne pas déclencher le tri quand on clique sur l'icône
  - Icône légèrement plus petite (`h-3 w-3`) que celle des KPI (`h-[14px]`) pour cohabiter avec les chevrons de tri

**Résultat :** tout en-tête de colonne calculée affiche désormais une `(i)` cliquable expliquant la métrique.

---

## Vue d'ensemble des fichiers modifiés

### Créés (5)

- `src/components/custom/ui/frosted-dialog.tsx`
- `src/hooks/period/period-context.tsx`
- `src/components/custom/asset-panel/kpi-tooltips.ts`
- `src/components/custom/watchlist/column-tooltips.ts`
- `CHANGELOG-2026-06-15.md` (ce fichier)

### Modifiés (6)

- `src/app/(admin)/layout.tsx`
- `src/components/custom/asset-panel/asset-panel.tsx`
- `src/components/custom/asset-panel/metric-card.tsx`
- `src/components/custom/screener/asset-search-modal.tsx`
- `src/components/custom/watchlist/watchlist-table.tsx`
- `src/components/custom/forms/dashboard/dashboard-form.tsx`

### Intacts (préservation)

- `src/components/ui/dialog.tsx` (shadcn d'origine)
- `src/components/ui/tooltip.tsx` (shadcn d'origine)
- Toutes les définitions de colonnes (`stock-columns.tsx`, etc.) — aucune n'a eu besoin d'édition

---

## Patterns architecturaux établis (à respecter par la suite)

1. **Custom shadcn variants** vont dans `src/components/custom/ui/` (ex : `frosted-dialog.tsx`). Le `src/components/ui/` reste pristine pour permettre `pnpm dlx shadcn@latest add ...`.

2. **Tooltips pédagogiques** → dictionnaire `*_TOOLTIPS` indexé par label, colocalisé avec le composant consommateur. Structure `{ definition, interpretation }`. Fallback gracieux si entrée absente.

3. **Période globale** → toujours via `usePeriod()` depuis `@/hooks/period/period-context`. Plus jamais de `useState<Period>` local pour le state principal.

4. **Composants AssetPanel** → controlled/uncontrolled pour `period`. Si nouveau composant exhibe le même besoin, suivre le même pattern (`controlledX ?? internalX`).

5. **Animations** → durations courtes (180-500ms), `ease-out`, Framer Motion `AnimatePresence` + `key` pour les transitions structurelles, Recharts natif pour les charts.

---

## Reste à faire (par ordre de priorité)

### 🔴 Critique

- **`yann.md`** : toujours en clair dans le repo avec les secrets (DB password, JWT_SECRET, SMTP_PASS, REFRESH_TOKEN_SECRET). À rotater + sortir du repo + `.gitignore`.

### 🟠 Important

- **README.md** : toujours boilerplate Next.js.
- **MyRoadbook.md** : doublons à nettoyer.
- **`}//Name` orphelins** : résidu du sweep Prettier dans les anciens fichiers Style A.
- **`/asset-panel-demo` et `/playground`** : à retirer du matcher du middleware `proxy.ts`.

### 🟡 Moyen

- Pages physiques `items/item_1/page_*` et `items/item_2/page_*` orphelines (plus dans le menu).
- Tests Vitest sur `lib/yann/analytics/metrics.ts` (formules financières non testées).
- Renommer `lib/yann/` en nom métier (`markets/`, `finance/`).

### 🟢 Mineur

- IP hardcodée `192.168.1.44` dans `next.config.ts`.
- `NextTopLoader` couleur `#000000` invisible en dark mode.
- Confirmer que `proxy.ts` tourne en `runtime: "nodejs"` (Prisma incompatible Edge).

### Idées produit ouvertes

- Page d'aide globale `/aide` avec lien depuis chaque tooltip "En savoir plus"
- Vidéos pédagogiques de l'Université de l'Épargne intégrées
- Comparateur multi-actifs
- Page détail d'un actif (au-delà de l'accordion)
- Mode "guidé débutant" avec onboarding métriques
- Alertes ("préviens-moi si X passe sous Y")

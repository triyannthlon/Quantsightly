# Quantsightly

> Dashboard web de **risk metrics** pour investisseurs particuliers — partenariat avec l'Université de l'Épargne.

## Vue d'ensemble

Quantsightly permet d'explorer les indicateurs de risque (rendements multi-horizons, volatilité, drawdown, Sharpe…) sur plusieurs classes d'actifs : **actions, ETF, indices, cryptomonnaies, devises**. Données journalières via un backend C++ propriétaire fronting EODHD.

Public cible : à la fois **débutants** en investissement (tooltips pédagogiques sur chaque métrique) et **utilisateurs confirmés**. UI 100 % en français.

## Stack technique

| Couche            | Outil                                              |
| ----------------- | -------------------------------------------------- |
| Framework         | Next.js 16.1.6 (App Router) + React 19             |
| Style             | Tailwind CSS v4 + shadcn/ui (`new-york`)           |
| Animations        | Framer Motion 12                                   |
| Charts            | Recharts 3                                         |
| Drag & drop       | @dnd-kit                                           |
| Formulaires       | react-hook-form + Zod                              |
| Auth              | Email OTP (sans mot de passe) + JWT (jose)         |
| ORM               | Prisma 7 (PostgreSQL)                              |
| Mail              | Nodemailer (SMTP)                                  |
| Tests             | Vitest 4 + coverage v8                             |
| Format / Lint     | Prettier 3 + ESLint 9 (`eslint-config-prettier`)   |
| Package manager   | pnpm                                               |
| Runtime container | node:20-alpine (Docker multi-stage, user non-root) |

## Quick start

```bash
git clone <repo>
cd quantsightly

cp .env.example .env       # remplir les valeurs réelles (voir section "Variables" plus bas)

pnpm install               # postinstall lance `prisma generate` automatiquement
pnpm dev                   # → http://localhost:3000
```

## Scripts disponibles

| Commande             | Effet                                       |
| -------------------- | ------------------------------------------- |
| `pnpm dev`           | Serveur de développement (Turbopack)        |
| `pnpm build`         | Build de production (`output: standalone`)  |
| `pnpm start`         | Démarre le serveur de production            |
| `pnpm test`          | Vitest en mode watch (relance auto)         |
| `pnpm test:run`      | Lance les tests une fois (pour CI)          |
| `pnpm test:coverage` | Rapport de couverture HTML dans `coverage/` |
| `pnpm lint`          | ESLint                                      |
| `pnpm format`        | Reformate tout avec Prettier                |
| `pnpm format:check`  | Vérifie le formatage sans modifier          |

## Architecture en 5 points clés

### 1. Trois groupes de routes

- `src/app/(auth)/` — Pages de connexion (email OTP)
- `src/app/(admin)/` — Pages protégées : `/home` (dashboard) + `/screener/asset-*` (5 types d'actifs)
- `src/app/(dev)/` — Bac à sable sans auth (`/playground`, `/asset-panel-demo`)

### 2. Deux bases PostgreSQL

- **`DATABASE_URL`** (Prisma) — Auth + watchlists : `User`, `Session`, `LoginCode`, `Watchlist`, `WatchlistItem`
- **`CODEDATA_DATABASE_URL`** (`pg` Pool brut) — Séries économiques pour le playground

### 3. Backend C++ via reverse proxy

Les données de marché (EODHD, catalogue ticker) viennent d'une API C++ propriétaire, exposée par Next.js via le rewrite `/qs-api/*` → `QS_BACKEND_URL` (cf. `next.config.ts`).

### 4. Période globale partagée

Toutes les pages `(admin)/*` partagent un **même état `period`** via le hook `usePeriod()` (`src/hooks/period/period-context.tsx`), persisté en `localStorage`. C'est la **source unique de vérité** — plus de `useState<Period>` local.

### 5. Couche métier dans `src/lib/markets/`

Toutes les formules financières (Sharpe, Drawdown, returns…), types de séries normalisées, builders de lignes watchlist par type d'actif, et clients HTTP vivent dans `src/lib/markets/`. Barrel export via `src/lib/markets/index.ts`. **Couverte par Vitest** (35 tests).

## Conventions de code

- **TypeScript strict** — zéro `any` toléré
- **Style Prettier standard** (4 espaces, double quotes, semi, trailing commas) — pas d'alignement vertical manuel
- **`src/components/ui/`** = shadcn pur, jamais modifié (permet `pnpm dlx shadcn@latest add ...`)
- **`src/components/custom/ui/`** = variantes maison des composants shadcn (ex. `frosted-dialog.tsx`)
- **Suffixe `*Action`** sur les callbacks props (convention React 19 / Next 16)
- **UI et emails en français**
- **Tout helper d'authentification client** doit passer par `fetchAuth` (`src/lib/api/fetch-auth.ts`) qui gère 401 → refresh → retry transparent

## Sécurité

- **Auth sans mot de passe** : email + code OTP 6 chiffres (valable 10 min)
- **Cookies `httpOnly`** : JWT access token 15 min + refresh opaque SHA-256 stocké en base
- **Sessions révocables** individuellement
- **`.env` jamais commit** (cf. `.gitignore`) — utiliser `.env.example` comme template
- **Secrets** : générer avec `openssl rand -base64 64`
- **Pas de secrets en clair** dans le code ni les notes versionnées

## Pages d'erreur custom

Les fallbacks `(admin)/error.tsx`, `(admin)/loading.tsx`, `(admin)/not-found.tsx` capturent crashes / loading SSR / 404 avec un design intégré qui conserve la sidebar et le header.

## Variables d'environnement

Voir `.env.example` à la racine. Variables essentielles :

| Variable                                                 | Rôle                                               |
| -------------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`                                           | Postgres auth (Prisma)                             |
| `CODEDATA_DATABASE_URL`                                  | Postgres séries économiques (`pg` Pool)            |
| `QS_BACKEND_URL`                                         | URL interne du backend C++ (Bloomberg + EODHD)     |
| `NEXT_PUBLIC_QS_API_URL`                                 | URL publique du reverse proxy (défaut : `/qs-api`) |
| `JWT_SECRET`                                             | Secret de signature JWT                            |
| `REFRESH_TOKEN_SECRET`                                   | Secret du refresh token (distinct du JWT)          |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `FROM_EMAIL` | Envoi des codes OTP par email                      |
| `NODE_ENV`                                               | `development` ou `production`                      |

## Documentation interne

- **`ONBOARDING.md`** — Brief technique détaillé (auth, données, composants)
- **`CHANGELOG-*.md`** — Historique des sessions de dev (1 fichier par session significative)
- **`MyRoadbook.md`** — Journal de notes du dev (patterns, snippets, commandes utiles)

## Déploiement

Le projet est containerisé via `Dockerfile` (multi-stage, user non-root, Next.js standalone output).

```bash
docker build -t quantsightly .
docker compose up                    # ou voir docker-compose.yml
```

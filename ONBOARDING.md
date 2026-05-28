# Quantsightly — Brief du projet

## Vue d'ensemble

**Quantsightly** est un dashboard web de visualisation et d'exploration de données économiques et financières (séries temporelles par pays et devise). L'application est construite avec Next.js 16.1.6 (App Router) et React 19, avec une interface en français orientée professionnels de la finance.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 16.1.6 (App Router, TypeScript) |
| UI | React 19, Tailwind CSS v4, Radix UI, Framer Motion |
| Base de données | PostgreSQL × 2 (Prisma ORM + pg Pool) |
| Auth | Email + OTP sans mot de passe, JWT + refresh token |
| Formulaires | React Hook Form + Zod |
| Email | Nodemailer (SMTP) |

---

## Architecture

### Routes (App Router)

```
(root)/           → Redirige vers /sign-in
(auth)/
  sign-in/        → Saisie email
  verify-code/    → Vérification OTP 6 chiffres
(admin)/
  home/           → Dashboard principal
  items/item_1/   → Pages 1–5
  items/item_2/   → Pages 1–3
(dev)/
  playground/     → Zone de développement/test
api/auth/
  send-code       POST — Envoi OTP par email
  verify-code     POST — Vérifie OTP, crée session
  refresh         POST — Renouvelle le token d'accès
  log-out         POST — Révoque la session
  sessions        GET  — Liste les sessions actives
```

### Deux bases de données PostgreSQL

- **`DATABASE_URL`** (Prisma) — Auth : tables `User`, `Session`, `LoginCode`
- **`CODEDATA_DATABASE_URL`** (pg Pool brut) — Données économiques : `economic_series` (métadonnées) + `economic_data` (points temporels)

---

## Authentification (sans mot de passe)

1. L'utilisateur saisit son email → API génère un code OTP à 6 chiffres (valable 10 min)
2. Code envoyé par email via Nodemailer
3. Utilisateur saisit le code → API vérifie et crée une session
4. Deux tokens émis en cookies `httpOnly` :
   - **Access token** JWT — expiration 15 min, auto-validant
   - **Refresh token** opaque — haché en SHA-256 en base, révocable
5. Sessions liées à l'IP et au User-Agent (détection mobile/laptop/écran)
6. Toutes les sessions précédentes sont révoquées à chaque nouvelle connexion

---

## Données économiques

- Séries organisées en hiérarchie : **pays → type → classe → devise**
- Filtres disponibles : pays, devise, plage de dates (mois/année)
- Les options de filtre sont mises en cache côté serveur (`unstable_cache`, revalidation 1h)
- Les données brutes sont lues via `pg Pool` directement (sans Prisma) pour des raisons de performance

---

## Composants UI notables

- `country-selector` — Dropdown de sélection de pays
- `currency-selector` — Badge/dropdown de devise
- `month-range-picker` — Sélecteur de plage de mois
- `sidebar` — Navigation latérale rétractable (Radix UI)
- Formulaires d'authentification avec animations Framer Motion
- Support thème clair/sombre via `next-themes`

---

## État du projet

- Authentification : **complète** (email OTP, gestion de sessions)
- Dashboard `(admin)` : **en cours** — les pages `item_1` et `item_2` sont des placeholders
- Playground `(dev)` : actif — contient un sélecteur de séries et comparaison de données
- CI/CD : non configuré
- Tests : non configurés

---

## Conventions de code

- TypeScript strict partout
- Composants client marqués `"use client"`, layouts et pages serveur par défaut
- Validation des entrées avec Zod (côté client et API)
- Toute l'UI et les emails sont en **français**
- Gestionnaire de paquets : **pnpm**

---

## Variables d'environnement clés

```
DATABASE_URL              — PostgreSQL auth (Prisma)
CODEDATA_DATABASE_URL     — PostgreSQL données économiques
JWT_SECRET                — Secret de signature JWT
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS — Config email
NEXT_PUBLIC_APP_URL       — URL de base de l'app
```
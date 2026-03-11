# syntax=docker/dockerfile:1

# ---- base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Active pnpm via corepack
RUN corepack enable

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm prisma generate

RUN pnpm build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Création de l'utilisateur non-root
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Copy only standalone runtime
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# 🔥 Correction des permissions
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next
USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
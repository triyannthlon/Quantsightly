# MyRoadbook — Notes de dev Quantsightly

Carnet de bord personnel : recettes, snippets, commandes, et architecture des morceaux que tu veux pouvoir retrouver vite.
Pour la vue d'ensemble du projet, voir [`README.md`](./README.md) et [`ONBOARDING.md`](./ONBOARDING.md).

---

## Sommaire

1. [Watchlist API (Next.js) — création des 4 routes](#1-watchlist-api-nextjs--création-des-4-routes)
2. [Tester la watchlist API](#2-tester-la-watchlist-api)
3. [Handler C++ — `CatalogResolveHandler`](#3-handler-c--catalogresolvehandler)
4. [Suite : composants frontend (étape 3 du pipeline watchlist)](#4-suite--composants-frontend-étape-3-du-pipeline-watchlist)

---

## 1. Watchlist API (Next.js) — création des 4 routes

Quatre fichiers à créer pour exposer la watchlist côté Next.

### Arborescence

```
src/
├── lib/
│   └── auth/
│       ├── get-user.ts          ← Fichier 1 (NOUVEAU)
│       └── tokens.ts            (existant)
│
└── app/
    └── api/
        └── me/
            └── watchlist/
                └── [type]/
                    ├── route.ts                  ← Fichier 2 (GET)
                    └── items/
                        ├── route.ts              ← Fichier 3 (POST)
                        └── [id]/
                            └── route.ts          ← Fichier 4 (DELETE)
```

### 📁 Fichier 1 — `src/lib/auth/get-user.ts` (helper)

```typescript
import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/tokens";

export type CurrentUser = {
  id: string;
  email: string;
  sessionId: string;
};

/**
 * Retourne le user courant à partir du cookie access_token.
 * Le middleware garantit la validité de l'access_token sur les routes /api/me/*.
 * Renvoie null si non authentifié → la route doit répondre 401.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) return null;

  try {
    const payload = await verifyAccessToken(accessToken);
    return {
      id: payload.userId,
      email: payload.email,
      sessionId: payload.sid,
    };
  } catch {
    return null;
  }
}
```

### 📁 Fichier 2 — `src/app/api/me/watchlist/[type]/route.ts` (GET)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["stock", "etf", "crypto", "currency"] as const;

/**
 * GET /api/me/watchlist/[type]
 * Récupère la watchlist du user pour un type donné.
 * Crée automatiquement la watchlist vide si elle n'existe pas.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { type } = await params;

  if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json(
      { error: "invalid_type", message: "type must be stock, etf, crypto or currency" },
      { status: 400 },
    );
  }

  // Upsert : crée la watchlist si elle n'existe pas, sinon la retourne
  const watchlist = await prisma.watchlist.upsert({
    where: { userId_assetType: { userId: user.id, assetType: type } },
    update: {},
    create: { userId: user.id, assetType: type },
    include: {
      items: { orderBy: [{ positionRank: "asc" }, { addedAt: "asc" }] },
    },
  });

  return NextResponse.json({
    watchlistId: watchlist.id.toString(),
    assetType: watchlist.assetType,
    items: watchlist.items.map((i) => ({
      id: i.id.toString(),
      symbol: i.symbol,
      positionRank: i.positionRank,
      addedAt: i.addedAt.toISOString(),
    })),
    count: watchlist.items.length,
  });
}
```

### 📁 Fichier 3 — `src/app/api/me/watchlist/[type]/items/route.ts` (POST)

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["stock", "etf", "crypto", "currency"] as const;

const PostBodySchema = z.object({
  symbols: z
    .array(
      z
        .string()
        .min(2)
        .max(50)
        .regex(/^[A-Z0-9.\-]+$/i, "symbol invalide"),
    )
    .min(1, "Au moins un symbol requis")
    .max(50, "Maximum 50 symbols par requête"),
});

/**
 * POST /api/me/watchlist/[type]/items
 * Body : { symbols: string[] }
 * Ajoute 1..N symbols à la watchlist (dédoublonnage automatique).
 */
export async function POST(request: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { type } = await params;

  if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", message: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const symbolsToAdd = parsed.data.symbols.map((s) => s.toUpperCase());

  // Auto-create watchlist
  const watchlist = await prisma.watchlist.upsert({
    where: { userId_assetType: { userId: user.id, assetType: type } },
    update: {},
    create: { userId: user.id, assetType: type },
  });

  // Quels symbols sont déjà présents ?
  const existing = await prisma.watchlistItem.findMany({
    where: { watchlistId: watchlist.id, symbol: { in: symbolsToAdd } },
    select: { symbol: true },
  });
  const existingSet = new Set(existing.map((e) => e.symbol));
  const newSymbols = symbolsToAdd.filter((s) => !existingSet.has(s));
  const skipped = symbolsToAdd.filter((s) => existingSet.has(s));

  // Trouver le rank max actuel
  const maxRank = await prisma.watchlistItem.findFirst({
    where: { watchlistId: watchlist.id },
    orderBy: { positionRank: "desc" },
    select: { positionRank: true },
  });
  let nextRank = (maxRank?.positionRank ?? 0) + 1;

  // Insérer les nouveaux symbols
  if (newSymbols.length > 0) {
    await prisma.watchlistItem.createMany({
      data: newSymbols.map((symbol, idx) => ({
        watchlistId: watchlist.id,
        symbol,
        positionRank: nextRank + idx,
      })),
    });
  }

  // Renvoyer la liste mise à jour
  const updatedItems = await prisma.watchlistItem.findMany({
    where: { watchlistId: watchlist.id },
    orderBy: [{ positionRank: "asc" }, { addedAt: "asc" }],
  });

  return NextResponse.json({
    watchlistId: watchlist.id.toString(),
    added: newSymbols,
    skipped,
    items: updatedItems.map((i) => ({
      id: i.id.toString(),
      symbol: i.symbol,
      positionRank: i.positionRank,
      addedAt: i.addedAt.toISOString(),
    })),
    count: updatedItems.length,
  });
}
```

### 📁 Fichier 4 — `src/app/api/me/watchlist/[type]/items/[id]/route.ts` (DELETE)

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["stock", "etf", "crypto", "currency"] as const;

/**
 * DELETE /api/me/watchlist/[type]/items/[id]
 * Retire un item de la watchlist (vérification d'ownership obligatoire).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { type, id } = await params;

  if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }

  let itemId: bigint;
  try {
    itemId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  // Sécurité critique : vérifier ownership avant de supprimer
  const item = await prisma.watchlistItem.findFirst({
    where: {
      id: itemId,
      watchlist: { userId: user.id, assetType: type },
    },
    select: { id: true },
  });

  if (!item) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.watchlistItem.delete({ where: { id: itemId } });

  return new NextResponse(null, { status: 204 });
}
```

---

## 2. Tester la watchlist API

Une fois les 4 fichiers créés, lance `pnpm dev` puis dans la console du navigateur (déjà connecté à ta session) :

```javascript
// Console navigateur (F12)

// 1. GET — récupérer la watchlist Stock (vide au début)
fetch("/api/me/watchlist/stock")
  .then((r) => r.json())
  .then(console.log);

// 2. POST — ajouter 3 actifs
fetch("/api/me/watchlist/stock/items", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ symbols: ["AAPL.US", "MSFT.US", "GOOGL.US"] }),
})
  .then((r) => r.json())
  .then(console.log);

// 3. GET à nouveau — voir les 3 items
fetch("/api/me/watchlist/stock")
  .then((r) => r.json())
  .then(console.log);

// 4. DELETE — retirer le premier (remplace 1 par l'ID retourné)
fetch("/api/me/watchlist/stock/items/1", { method: "DELETE" }).then((r) =>
  console.log("Status:", r.status),
); // doit être 204
```

> **Note d'architecture :** côté C++, créer `/api/catalog/resolve` (léger) pour l'affichage de la watchlist, puis `/api/stock/:symbol` au clic sur une ligne pour les détails complets. Séparation claire : « liste = léger », « détail = complet ».

---

## 3. Handler C++ — `CatalogResolveHandler`

Architecture verrouillée : **Next.js → API C++ → eodhd**, pas de connexion directe.

### 📄 `CatalogResolveHandler.h` (nouveau)

```cpp
#ifndef _CatalogResolveHandler_
#define _CatalogResolveHandler_

#include "HttpRouter.h"

/*
   Endpoint léger de résolution de symbols → métadonnées catalogue.

   GET /api/catalog/resolve?symbols=AAPL.US,MSFT.US,GOOGL.US

   Lit tickers_catalog (JOIN exchanges pour le code pays ISO).
   Ne déclenche AUCUN pattern on-demand : pure lecture du catalogue.
   Utilisé pour afficher une watchlist (noms, types, drapeaux).
*/

void CatalogResolveHandler_Get(const THttpRouteContext& Ctx, THttpRouteResult& Res);

#endif
```

### 📄 `CatalogResolveHandler.cpp` (nouveau)

```cpp
#include <vcl.h>
#pragma hdrstop

#include <System.JSON.hpp>
#include <FireDAC.Comp.Client.hpp>
#include <memory>

#include "CatalogResolveHandler.h"
#include "DataModule.h"

#pragma package(smart_init)


/********** ParseQueryParam (si pas déjà accessible globalement) *****/
static String ParseQueryParam(const String& QueryStr, const String& Key)
       {//ParseQueryParam

       if(QueryStr.IsEmpty()) return "";

       std::unique_ptr<TStringList> Parts(new TStringList());
                                    Parts->Delimiter       = '&';
                                    Parts->StrictDelimiter = true;
                                    Parts->DelimitedText   = QueryStr;

       String KeyPrefix = Key + "=";
       int    KeyLen    = KeyPrefix.Length();

       for(int iInc1 = 0; iInc1 < Parts->Count; iInc1++)
          {
          String P = Parts->Strings[iInc1];
              if(P.SubString(1, KeyLen) == KeyPrefix) { return P.SubString(KeyLen + 1, P.Length() - KeyLen);}
          }

       return "";

       }//ParseQueryParam


/*** CatalogResolveHandler_Get *****/
void CatalogResolveHandler_Get(const THttpRouteContext& Ctx, THttpRouteResult& Res)
     {//CatalogResolveHandler_Get

     /* ─── 1. Extraction du paramètre symbols ─── */

     String Raw = ParseQueryParam(Ctx.Query, "symbols");
     String Symbols = UrlDecode(Raw).Trim().UpperCase();

     if(Symbols.IsEmpty())//(1)
       {//(1)
       Res.Status = 400                                  ;
       Res.Body   = L"{\"error\":\"missing_symbols\"}";

       Res.Headers->Add("Cache-Control=no-cache");

       return;
       }//(1)

     /* ─── 2. Garde-fou : max 100 symbols ─── */

     int CommaCount = 0;
     for(int iInc1 = 1; iInc1 <= Symbols.Length(); iInc1++)
        if(Symbols[iInc1] == ',') CommaCount++;

     if(CommaCount > 99)//(1)
       {//(1)
       Res.Status = 400                                          ;
       Res.Body   = L"{\"error\":\"too_many_symbols\",\"max\":100}";

       Res.Headers->Add("Cache-Control=no-cache");

       return;
       }//(1)

     /* ─── 3. SELECT batch (JOIN exchanges pour le code ISO pays) ─── */

     std::unique_ptr<TJSONArray> Arr(new TJSONArray());

     try
       {
       std::unique_ptr<TFDQuery> Q(new TFDQuery(NULL));
                                 Q->Connection = DM->FDConnection;

                                 Q->SQL->Text = "SELECT tc.symbol, tc.code, tc.exchange_code, tc.sub_market, "
                                                "       tc.name, tc.type, tc.isin, tc.currency, tc.country, "
                                                "       e.country_iso2 "
                                                "FROM tickers_catalog tc "
                                                "LEFT JOIN exchanges e ON e.code = tc.exchange_code "
                                                "WHERE tc.symbol = ANY(string_to_array(:syms, ',')) "
                                                "  AND tc.is_active = TRUE";

                                 Q->Params->ParamByName("syms")->DataType = ftMemo;
                                 Q->Params->ParamByName("syms")->Size     = Symbols.Length() + 1;
                                 Q->ParamByName("syms")->AsString = Symbols;

                                 Q->Open();

       while(!Q->Eof)//(1)
            {//(1)
            TJSONObject* Item = new TJSONObject();

                                                          Item->AddPair("symbol", new TJSONString(Q->FieldByName("symbol")->AsString));
                                                          Item->AddPair("name"  , new TJSONString(Q->FieldByName("name"  )->AsString));

            if(!Q->FieldByName("code"         )->IsNull)  Item->AddPair("code"         , new TJSONString(Q->FieldByName("code"         )->AsString));
            if(!Q->FieldByName("exchange_code")->IsNull)  Item->AddPair("exchange_code", new TJSONString(Q->FieldByName("exchange_code")->AsString));
            if(!Q->FieldByName("sub_market"   )->IsNull)  Item->AddPair("sub_market"   , new TJSONString(Q->FieldByName("sub_market"   )->AsString));
            if(!Q->FieldByName("type"         )->IsNull)  Item->AddPair("type"         , new TJSONString(Q->FieldByName("type"         )->AsString));
            if(!Q->FieldByName("isin"         )->IsNull)  Item->AddPair("isin"         , new TJSONString(Q->FieldByName("isin"         )->AsString));
            if(!Q->FieldByName("currency"     )->IsNull)  Item->AddPair("currency"     , new TJSONString(Q->FieldByName("currency"     )->AsString));
            if(!Q->FieldByName("country"      )->IsNull)  Item->AddPair("country"      , new TJSONString(Q->FieldByName("country"      )->AsString));
            if(!Q->FieldByName("country_iso2" )->IsNull)  Item->AddPair("country_iso2" , new TJSONString(Q->FieldByName("country_iso2" )->AsString));

            Arr->AddElement(Item);

                                 Q->Next();
            }//(1)
       }
     catch(Exception& E)
       {
       Res.Status = 500                                                                 ;
       Res.Body   = L"{\"error\":\"internal_error\",\"message\":\"" + E.Message + L"\"}";

       Res.Headers->Add("Cache-Control=no-cache");

       return;
       }

     /* ─── 4. Réponse ─── */

       Res.Status = 200             ;
       Res.Body   = Arr->ToString();

       Res.Headers->Add("Cache-Control=public, s-maxage=3600, stale-while-revalidate=86400"); /* Catalogue stable, cache 1h */

     }//CatalogResolveHandler_Get
```

### Enregistrer la route

Dans ton fichier de routing (avec les autres `Router->Register`) :

```cpp
#include "CatalogResolveHandler.h"

Router->Register("GET", "/api/catalog/resolve", CatalogResolveHandler_Get);
```

### Format de réponse

```bash
curl "http://192.168.1.100:4000/api/catalog/resolve?symbols=AAPL.US,MSFT.US,BTC-USD.CC"
```

```json
[
  {
    "symbol": "AAPL.US",
    "name": "Apple Inc",
    "code": "AAPL",
    "exchange_code": "US",
    "type": "Common Stock",
    "isin": "US0378331005",
    "currency": "USD",
    "country": "USA",
    "country_iso2": "US"
  },
  {
    "symbol": "MSFT.US",
    "name": "Microsoft Corp",
    "country_iso2": "US"
  },
  {
    "symbol": "BTC-USD.CC",
    "name": "Bitcoin",
    "currency": "USD",
    "country_iso2": null
  }
]
```

### ✨ Pourquoi le JOIN exchanges

`tickers_catalog.country` contient « USA » / « Germany » (nom complet). Pour afficher `<FlagIcon code="US" />`, il faut le **code ISO 2 lettres** → c'est `exchanges.country_iso2`. Le JOIN te le donne directement.

→ Côté frontend : `<FlagIcon code={item.country_iso2} />` + `<CurrencyFlag code={item.currency} />`. 🎯

### Tester après recompilation

```powershell
# Recompiler + redémarrer
Restart-Service QuantsightlyAPI

# Tester via le proxy Next
curl "http://localhost:3000/qs-api/api/catalog/resolve?symbols=AAPL.US,MSFT.US"

# Ou direct
curl "http://192.168.1.100:4000/api/catalog/resolve?symbols=AAPL.US,MSFT.US"
```

---

## 4. Suite : composants frontend (étape 3 du pipeline watchlist)

```
src/
├── lib/markets/watchlist/
│   └── clients/watchlist-client.ts   ← 3a : appels API (watchlist + resolve)
│
├── hooks/
│   └── use-watchlist.ts              ← 3b : hook qui charge + résout
│
├── components/custom/screener/
│   └── screener-page.tsx             ← 3c : composant principal
│
├── components/custom/watchlist/
│   ├── watchlist-table.tsx           ← 3d : la table
│   └── watchlist-row.tsx             ← 3d : une ligne + sous-menu
│
└── app/(admin)/screener/
    ├── asset-stock/page.tsx          ← point d'entrée (3 lignes)
    ├── asset-etf/page.tsx
    ├── asset-crypto/page.tsx
    ├── asset-index/page.tsx
    └── asset-currency/page.tsx
```

- `watchlist-client.ts` — les fonctions fetch (GET watchlist, POST resolve, DELETE item). Utilise désormais `fetchAuth` (`lib/api/fetch-auth.ts`) pour le handling 401 centralisé.
- `use-watchlist.ts` — le hook React (mise à jour optimiste + rollback + toast)
- `screener-page.tsx` + table + row — la page complète
- Les 5 `page.tsx` (un par type d'actif) — points d'entrée minces qui rendent `<ScreenerPage assetType="..." />`

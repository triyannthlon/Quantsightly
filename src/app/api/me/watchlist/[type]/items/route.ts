import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["stock", "etf", "crypto", "currency"] as const;

const PostBodySchema = z.object({
  symbols: z
    .array(z.string().min(2).max(50).regex(/^[A-Z0-9.\-]+$/i, "symbol invalide"))
    .min(1, "Au moins un symbol requis")
    .max(50, "Maximum 50 symbols par requête"),
});

/**
 * POST /api/me/watchlist/[type]/items
 * Body : { symbols : string[] }
 * Ajoute 1 ... N symbols à la watchlist (dédoublonnage automatique).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
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
    where : { userId_assetType: { userId: user.id, assetType: type } },
    update: {},
    create: { userId: user.id, assetType: type },
  });

  // Quels symbols sont déjà présents ?
  const existing = await prisma.watchlistItem.findMany({
    where  : { watchlistId: watchlist.id, symbol: { in: symbolsToAdd } },
    select : { symbol: true },
  });
  const existingSet = new Set(existing.map((e) => e.symbol));
  const newSymbols  = symbolsToAdd.filter((s) => !existingSet.has(s));
  const skipped     = symbolsToAdd.filter((s) =>  existingSet.has(s));

  // Trouver le rank max actuel
  const maxRank = await prisma.watchlistItem.findFirst({
    where  : { watchlistId: watchlist.id },
    orderBy: { positionRank: "desc" },
    select : { positionRank: true },
  });
  const nextRank = (maxRank?.positionRank ?? 0) + 1;

  // Insérer les nouveaux symbols
  if (newSymbols.length > 0) {
    await prisma.watchlistItem.createMany({
      data: newSymbols.map((symbol, idx) => ({
        watchlistId  : watchlist.id,
        symbol,
        positionRank : nextRank + idx,
      })),
    });
  }

  // Renvoyer la liste mise à jour
  const updatedItems = await prisma.watchlistItem.findMany({
    where  : { watchlistId: watchlist.id },
    orderBy: [{ positionRank: "asc" }, { addedAt: "asc" }],
  });

  return NextResponse.json({
    watchlistId : watchlist.id.toString(),
    added       : newSymbols,
    skipped,
    items       : updatedItems.map((i) => ({
      id           : i.id.toString(),
      symbol       : i.symbol,
      positionRank : i.positionRank,
      addedAt      : i.addedAt.toISOString(),
    })),
    count: updatedItems.length,
  });
}
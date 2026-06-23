import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["stock", "etf", "crypto", "currency", "index", "bond"] as const;

/**
 * GET /api/me/watchlist/[type]
 * Récupère la watchlist de l'utilisateur pour un type donné.
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
      {
        error: "invalid_type",
        message: "type must be stock, etf, crypto, currency, index or bond",
      },
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
      isFavorite: i.isFavorite,
      addedAt: i.addedAt.toISOString(),
    })),
    count: watchlist.items.length,
  });
}

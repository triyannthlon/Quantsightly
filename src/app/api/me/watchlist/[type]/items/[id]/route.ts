import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = ["stock", "etf", "crypto", "currency", "index", "bond"] as const;

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

/**
 * PATCH /api/me/watchlist/[type]/items/[id]
 * { isFavorite: boolean } — épingle / désépingle un item.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, id } = await params;
  if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number]))
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  let itemId: bigint;
  try {
    itemId = BigInt(id);
  } catch {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  if (typeof body?.isFavorite !== "boolean")
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const item = await prisma.watchlistItem.findFirst({
    where: { id: itemId, watchlist: { userId: user.id, assetType: type } },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.watchlistItem.update({
    where: { id: itemId },
    data: { isFavorite: body.isFavorite },
  });

  return new NextResponse(null, { status: 204 });
}

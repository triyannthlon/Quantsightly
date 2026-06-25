import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";
import type { ComparisonConfig, SavedComparison } from "@/app/(admin)/comparaisons/comparison";

/**
 * GET /api/me/comparators
 * Liste les comparaisons épinglées de l'utilisateur (ordonnées).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await prisma.savedComparator.findMany({
    where: { userId: user.id },
    orderBy: [{ positionRank: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, config: true },
  });

  const comparisons: SavedComparison[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    config: JSON.parse(r.config) as ComparisonConfig,
  }));

  return NextResponse.json({ comparisons });
}

/**
 * POST /api/me/comparators
 * Body : { title: string, config: ComparisonConfig } — épingle une comparaison.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    title?: unknown;
    config?: ComparisonConfig;
  };

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || !body.config || typeof body.config.serieAId !== "string") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const count = await prisma.savedComparator.count({ where: { userId: user.id } });

  const row = await prisma.savedComparator.create({
    data: {
      userId: user.id,
      title: title.slice(0, 200),
      config: JSON.stringify(body.config),
      positionRank: count,
    },
    select: { id: true, title: true, config: true },
  });

  const comparison: SavedComparison = {
    id: row.id,
    title: row.title,
    config: JSON.parse(row.config) as ComparisonConfig,
  };

  return NextResponse.json({ comparison }, { status: 201 });
}

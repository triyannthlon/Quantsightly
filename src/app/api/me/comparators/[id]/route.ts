import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/me/comparators/[id]
 * Retire une comparaison épinglée de l'utilisateur.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.savedComparator.deleteMany({ where: { id, userId: user.id } });

  return new NextResponse(null, { status: 204 });
}

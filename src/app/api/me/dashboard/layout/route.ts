import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-user";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/me/dashboard/layout
 * Retourne l'ordre sauvegardé des cards du dashboard (tableau d'IDs).
 */
export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const row = await prisma.users.findUnique({
        where : { id: user.id },
        select: { dashboardLayout: true },
    });

    const layout: string[] = row?.dashboardLayout
        ? (JSON.parse(row.dashboardLayout) as string[])
        : [];

    return NextResponse.json({ layout });
}

/**
 * PATCH /api/me/dashboard/layout
 * Body : { layout: string[] }  — tableau ordonné d'IDs de WatchlistItem
 */
export async function PATCH(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as { layout?: unknown };

    if (!Array.isArray(body.layout) || !body.layout.every((id) => typeof id === "string")) {
        return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    await prisma.users.update({
        where: { id: user.id },
        data : { dashboardLayout: JSON.stringify(body.layout) },
    });

    return new NextResponse(null, { status: 204 });
}

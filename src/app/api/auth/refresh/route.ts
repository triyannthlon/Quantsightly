import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { jwtVerify, SignJWT } from "jose";
import { REFRESH_TOKEN_SECRET, JWT_SECRET } from "@/lib/auth/jwt";
import { jsonError, jsonSuccess } from "@/lib/api/response";
import { hashRefreshToken } from "@/lib/auth/tokens";

/******************** POST *****/
export async function POST() {
  interface RefreshPayload {
    sid: string;
    email: string;
    userId: string;
  }

  const cookieStore = await cookies();
  const refresh = cookieStore.get("refresh_token")?.value;

  if (!refresh) {
    return jsonError("Aucun rafraîchissement", 401);
  }

  try {
    const { payload } = await jwtVerify<RefreshPayload>(refresh, REFRESH_TOKEN_SECRET);

    const session = await prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session) {
      return jsonError("Session introuvable", 401);
    }

    const hashed = hashRefreshToken(refresh);
    if (hashed !== session.refreshHash) {
      return jsonError("Refresh token invalide", 401);
    }

    if (session.expiresAt < new Date()) {
      return jsonError("Session expirée", 401);
    }

    const newAccess = await new SignJWT({
      userId: payload.userId,
      email: payload.email,
      sid: session.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("15m")
      .sign(JWT_SECRET);

    cookieStore.set("access_token", newAccess, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return jsonSuccess();
  } catch {
    return jsonError("Rafraîchissement invalide", 401);
  }
}

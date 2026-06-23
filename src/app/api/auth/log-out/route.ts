import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/prisma";
import { jsonSuccess } from "@/lib/api/response";
import * as Console from "node:console";

/******************** POST *****/
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (token) {
    try {
      const payload = await verifyAccessToken(token);

      Console.debug(payload.sid);

      await prisma.session.delete({ where: { id: payload.sid } }); /* Suppression de la session */
    } catch {}
  }

  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");

  return jsonSuccess();
}

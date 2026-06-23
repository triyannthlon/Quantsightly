import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { SendEmail } from "@/lib/email";
import { jsonError, jsonSuccess } from "@/lib/api/response";

/******************** POST *****/
export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return jsonError("E-mail est requis", 400);
    }

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      return jsonError("Utilisateur introuvable", 400);
    }

    const code = randomInt(100000, 999999).toString();
    await prisma.loginCode.create({
      data: { userId: user.id, code, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    await SendEmail({ To: email, Code: `${code}` });

    return jsonSuccess();
  } catch (error) {
    return jsonError(`Erreur lors de l'envoi : ${error}`, 500);
  }
}

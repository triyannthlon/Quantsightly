import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import {jsonError, jsonSuccess} from "@/lib/api/response";
import {signAccessToken, generateRefreshToken, hashRefreshToken,} from "@/lib/auth/tokens";

/******************** POST *****/
export async function POST(req: Request)
                      {//POST

                      const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

                      try {
                          const { email, code } = await req.json();

                          if(!email || !code) { return jsonError("E-mail et code requis",400); }

                          const user = await prisma.users.findUnique({where: { email },});

                            if(!user){return jsonError("Utilisateur introuvable",400);}

                          const loginCode = await prisma.loginCode.findFirst({where: {userId: user.id, used: false,}, orderBy: { createdAt: "desc" },});

                            if(!loginCode                       ){ return jsonError("Aucun code actif trouvé", 400 ); }
                            if( loginCode.expiresAt < new Date()){ return jsonError("Le code a expiré"       , 400 ); }
                            if( loginCode.code !== code         ){ return jsonError("Code incorrect"         , 400 ); }

                          await prisma.loginCode.update({where: { id: loginCode.id }, data: { used: true },}); /* Marquer le code comme utilisé */

                          const refreshToken = generateRefreshToken();

                                          await prisma.session.deleteMany({ where: { userId: user.id }, }); /* Supression de toues les sessions antérieures (toute ip) */

                               const rawIP = req.headers.get("x-forwarded-for");
                          const IP = rawIP ?.split(",")[0]?.trim() ?? null;

                          const session = await prisma.session.create({data: {      userId: user.id,
                                                                                refreshHash: hashRefreshToken(refreshToken),
                                                                                  expiresAt: new Date(Date.now() + SESSION_DURATION),
                                                                                  userAgent: req.headers.get("user-agent"),
                                                                                         ip: IP,},});

                          const accessToken = await signAccessToken({userId:user.id,email: user.email, sid: session.id,});

                          const cookieStore = await cookies();

                                cookieStore.set("access_token",  accessToken,{httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",});
                                cookieStore.set("refresh_token",refreshToken,{httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DURATION / 1000,});

                                     return jsonSuccess();
                          }
                      catch(error) { return jsonError  (`Erreur lors de la vérification : ${error}`,500); }

                     }//POST






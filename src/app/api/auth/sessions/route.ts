import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonSuccess } from "@/lib/api/response";
import { verifyAccessToken } from "@/lib/auth/tokens";

/******************** GET *****/
export async function GET()
                      {//GET

                              const cookieStore = await cookies();
                      const token = cookieStore.get("access_token")?.value;

                        if(!token)                                       {return jsonError("Non autorisé"  , 401);}

                     try {
                         const payload = await verifyAccessToken(token);

                         const session = await prisma.session.findUnique({where: { id: payload.sid },});

                         if(!session || session.expiresAt < new Date()) {return jsonError("Session invalide", 401);}

                         return jsonSuccess({ session });
                         }
                     catch                                              {return jsonError("Session invalide", 401);}

       }//GET

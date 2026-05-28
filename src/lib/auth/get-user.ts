import { cookies } from "next/headers";
import { verifyAccessToken } from "@/lib/auth/tokens";

/******************** getCurrentUser *****/
export async function getCurrentUser()
       {//getCurrentUser

       /**
        * Retourne l'utilisateur courant à partir du cookie access_token.
        * À utiliser dans les API routes qui passent par le middleware
        * (le middleware garantit que l'access_token est valide ou rejette).

        * Renvoie null si non authentifié (mais en théorie ça n'arrive pas
        * si la route est dans le matcher du middleware).
        **/

                                                        const cookieStore = await cookies();
                                          const accessToken = cookieStore.get("access_token")?.value;

                                            if(!accessToken) return null;

       try
         {
         const payload = await verifyAccessToken(accessToken);

         return {        id: payload.userId as string,
                      email: payload.email  as string,
                  sessionId: payload.sid    as string}; /* Optionnel : re-vérifier la session en BDD pour les actions sensibles (le middleware l'a déjà fait, donc ici, on peut faire confiance) */
         }
       catch {return null;}

       }//getCurrentUser
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {generateRefreshToken, hashRefreshToken, signAccessToken, verifyAccessToken} from "@/lib/auth/tokens";
import {prisma} from "@/lib/prisma";

/******* redirectToSignIn *****/
function redirectToSignIn(nextRequest: NextRequest)
         {//redirectToSignIn

         return NextResponse.redirect(new URL("/", nextRequest.url));

         }//redirectToSignIn


/******* logOut *****/
function logOut(nextRequest: NextRequest)
         {//logOut

          const nextResponse = redirectToSignIn(nextRequest);

                nextResponse.cookies.delete( "access_token");
                nextResponse.cookies.delete("refresh_token");

         return nextResponse;

         }//logOut

/******* extractSessionID *****/
function extractSessionID(token: string): string | null
         {//extractSessionID

         try {
              const payload = JSON.parse( Buffer.from(token.split(".")[1], "base64").toString() );
             return payload.sid ?? null;
             }
         catch { return null; }

         }//extractSessionID


function denyAccess(nextRequest: NextRequest, isApiRoute: boolean) {
    if (isApiRoute) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return redirectToSignIn(nextRequest);
}


const PUBLIC_ROUTES = ["/","/sign-in", "/verify-code"];

/******************** proxy *****/
export async function proxy(nextRequest: NextRequest)
                     {//proxy

                     const pathname = nextRequest.nextUrl.pathname;

                     const isApiRoute = pathname.startsWith("/api/");
                     
                     const isPublic = PUBLIC_ROUTES.includes(pathname);

                     const  accessToken = nextRequest.cookies.get( "access_token")?.value;
                     const refreshToken = nextRequest.cookies.get("refresh_token")?.value;

                        if(!accessToken)
                          {
                          if (!isPublic) return denyAccess(nextRequest,isApiRoute); /* Pas de token → accès interdit aux routes privées */
                                         return NextResponse.next();
                          }

                     try {
                                                                                const payload = await verifyAccessToken(accessToken);
                         const session = await prisma.session.findUnique({where: {id: payload.sid},select: { revokedAt: true }});
                           if(!session ||
                               session.revokedAt) {return logOut(nextRequest);}

                         if(isPublic)
                           return NextResponse.redirect(new URL("/home", nextRequest.url)); /* Si connecté → empêcher l’accès aux routes publiques */

                           return NextResponse.next();

                        } catch { /* access token expiré → on tente le refresh */}

                         // au lieu de : if (!refreshToken) return logOut(nextRequest);
                         if (!refreshToken) {
                             if (isApiRoute) return NextResponse.json({ error: "session_expired" }, { status: 401 });
                             return logOut(nextRequest);
                         }

                    const sessionID = extractSessionID(accessToken);
                      if(!sessionID)
                        return logOut(nextRequest);

                    const session = await prisma.session.findUnique({where: {id: sessionID}, include: {user: true},});
                      if(!session ||
                          session.revokedAt) return logOut(nextRequest);

                                            const hashed = hashRefreshToken(refreshToken);
                       if(session.refreshHash !== hashed) return logOut(nextRequest);

                                                      const newRefreshToken = generateRefreshToken();
                    const newRefreshHash = hashRefreshToken(newRefreshToken);

                    await prisma.session.update({ where: { id: session.id }, data: { refreshHash: newRefreshHash }, }); /* Mise à jour de la session */


                    const newAccessToken = await signAccessToken({ userId: session.userId    ,
                                                                    email: session.user.email,
                                                                      sid: session.id,}); /* Raffraîchissement OK → nouvel access_token */

                    /* ─── Propagation du token rafraîchi à la requête courante ───
                       Sans ça, la route API en aval (getCurrentUser) lirait
                       encore l'ancien access_token expiré dans le header Cookie
                       et renverrait 401. On réécrit le header Cookie de la
                       requête avec les nouveaux jetons.                          */

                    const requestHeaders = new Headers(nextRequest.headers);

                    const rewrittenCookies = nextRequest.cookies.getAll().map((c) =>
                          {
                          if(c.name === "access_token" ) return `access_token=${newAccessToken}`;
                          if(c.name === "refresh_token") return `refresh_token=${newRefreshToken}`;
                          return `${c.name}=${c.value}`;
                          });

                    requestHeaders.set("cookie", rewrittenCookies.join("; "));

                    /*  Mise à jour des cookies */

                     const nextResponse = NextResponse.next({ request: { headers: requestHeaders } });
                           nextResponse.cookies.set("access_token",  newAccessToken, { httpOnly: true                                ,
                                                                                        secure: process.env.NODE_ENV === "production",
                                                                                      sameSite: "lax"                                ,
                                                                                          path: "/",});
                           nextResponse.cookies.set("refresh_token",newRefreshToken, { httpOnly: true                                 ,
                                                                                         secure: process.env.NODE_ENV === "production",
                                                                                       sameSite: "lax"                                ,
                                                                                           path: "/",});

                    return nextResponse;

                    }//proxy


export const config = {matcher: ["/","/sign-in", "/verify-code","/dashboard/:path*","/api/me/:path*"],};







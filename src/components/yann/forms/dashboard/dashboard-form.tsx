"use client";

import { useSessions } from "@/hooks/auth/sessions/useSessions";
import { Card, CardHeader,CardFooter, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Laptop, Smartphone, Monitor,} from "lucide-react";
import {useRouter} from "next/navigation";
import {ConfirmLogOutForm} from "@/components/yann/forms/auth/confirm-log-out-form";

/********************** DashboardPage *****/
export default function DashboardPage()
                        {//DashboardPage

                        const {session,loading,} = useSessions();

                        const router = useRouter();

                        function getDeviceIcon(ua?: string | null)
                                 {
                                 if (!ua) return <Monitor className="w-5 h-5 text-muted-foreground" />;

                                 const lower = ua.toLowerCase();
                                    if(lower.includes("iphone") || lower.includes("android"))                           return <Smartphone className="w-5 h-5 text-muted-foreground" />;
                                    if(lower.includes("mac"   ) || lower.includes("windows") || lower.includes("linux"))return <Laptop     className="w-5 h-5 text-muted-foreground" />;

                                                                                                                        return <Monitor    className="w-5 h-5 text-muted-foreground" />;
                                 }

                       /************* logOut *****/
                       async function logOut()
                                      {//logOut

                                      await       fetch("/api/auth/log-out", { method: "POST" });
                                            router.push("/");

                                      }//logOut

                       if(loading )return <div className="p-6">Chargement…</div>;

                       if(!session)return null;

                       return (
                              <div className="p-6 max-w-3xl mx-auto space-y-6">
                                  {/* En-tête */}
                                  <header className="space-y-1">
                                      <h1 className="text-3xl font-semibold tracking-tight">
                                          Sécurité du compte
                                      </h1>
                                      <p className="text-muted-foreground">
                                          Informations sur votre session active.
                                      </p>
                                  </header>

                               <Separator />

                               <Card key={session.id} className="border-primary/50 bg-primary/5">
                                <CardHeader className="flex flex-row items-center justify-between">
                                 <div className="flex items-center gap-3">
                                  {getDeviceIcon(session.userAgent)}
                                  <CardTitle className="text-lg">Session active</CardTitle>
                                 </div>
                                 <Badge>Connecté</Badge>
                                </CardHeader>

                                <CardContent className="space-y-4 text-sm">
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                   <p className="text-muted-foreground">Adresse IP</p>
                                   <p className="font-medium text-foreground">{session.ip ?? "Inconnue"}</p>
                                  </div>

                                  <div>
                                   <p className="text-muted-foreground">Connexion établie le</p>
                                   <p className="font-medium text-foreground">{new Date(session.createdAt).toLocaleString()}</p>
                                  </div>
                                 </div>
                                </CardContent>

                                <CardFooter className="flex flex-col items-start gap-2">
                                 <ConfirmLogOutForm onConfirmAction={logOut} />
                                </CardFooter>
                               </Card>
                              </div>);

                        }//DashboardPage


import { cookies } from "next/headers";
import {AccessTokenPayload, verifyAccessToken} from "@/lib/auth/tokens";
import DashboardMotionLayout from "@/lib/layouts/dashboard/motion";
import {redirect} from "next/navigation";
import AppHeader from "@/components/yann/app-shell/app-header";
import {SidebarProvider} from "@/hooks/sidebar";
import AppSidebar from "@/components/yann/app-shell/app-sidebar";
import {ReactNode} from "react";


/************* getSession *****/
async function getSession(): Promise<AccessTokenPayload | null>
               {//getSession

                       const cookieStore = await cookies();
               const token = cookieStore.get("access_token")?.value;
                 if(!token) return null;

               try {
                   return await verifyAccessToken(token);
                   }
               catch {return null;}

                }//getSession


/**************************** DashboardLayout *****/
export default async function DashboardLayout({ children }: { children: ReactNode })
                              {//DashboardLayout

                              const session = await getSession();
                                if(!session) redirect("/");

                              return (
                                     <DashboardMotionLayout>
                                      <SidebarProvider>
                                       <div className="flex h-screen w-full bg-background">
                                        <AppSidebar />
                                        <div className="flex min-w-0 flex-1 flex-col">
                                          <AppHeader email={session.email} />

                                         <main className="min-h-0 flex-1 overflow-auto"> {/* Contenu scrollable uniquement ici */}
                                          {children}
                                         </main>

                                        </div>
                                       </div>
                                      </SidebarProvider>
                                     </DashboardMotionLayout>
                                     );

                              }//DashboardLayout

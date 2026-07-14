import { cookies } from "next/headers";
import { AccessTokenPayload, verifyAccessToken } from "@/lib/auth/tokens";
import DashboardMotionLayout from "@/lib/layouts/dashboard/motion";
import { redirect } from "next/navigation";
import AppHeader from "@/components/custom/app-shell/app-header";
import { SidebarProvider } from "@/hooks/sidebar";
import { PeriodProvider } from "@/hooks/period/period-context";
import { TransitionProvider } from "@/hooks/model-settings/transition-context";
import AppSidebar from "@/components/custom/app-shell/app-sidebar";
import { ReactNode } from "react";

/************* getSession *****/
async function getSession(): Promise<AccessTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;

  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

/**************************** DashboardLayout *****/
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <DashboardMotionLayout>
      <PeriodProvider>
        <TransitionProvider>
        <SidebarProvider>
          <div className="flex h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <AppHeader email={session.email} />

              <main className="min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
                {" "}
                {/* Contenu scrollable uniquement ici */}
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
        </TransitionProvider>
      </PeriodProvider>
    </DashboardMotionLayout>
  );
}

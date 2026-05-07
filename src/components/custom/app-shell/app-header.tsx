"use client";

import * as React from "react";
import { Menu, MoreHorizontal,} from "lucide-react";

import { ThemeToggle } from "@/components/custom/header/theme-toggle";
import UserDropdown from "@/components/custom/header/user-dropdown";
import {useSidebarActions,} from "@/hooks/sidebar";

import { Button } from "@/components/ui/button";
import {Sheet, SheetContent, SheetTrigger,} from "@/components/ui/sheet";

type AppHeaderProps = { email: string; };

/**** AppHeader *****/
const AppHeader: React.FC <AppHeaderProps>= ({email}) =>
      {

      const { toggleSidebar, toggleMobileSidebar } = useSidebarActions();

      const handleToggleSidebar = () => {

                                        if (window.innerWidth >= 1280) toggleSidebar(); else toggleMobileSidebar();

                                        };

      return (
             <header className="sticky top-0 z-50 w-full bg-background border-b">
              <div className="flex h-16 shrink-0 w-full items-center justify-between px-3 xl:px-6"> {/* AppHeader hauteur fixe h-16 avec SidebarBrand */}
               {/* Top row */}
               <div className="flex w-full items-center justify-between gap-2 border-b px-3 py-3 xl:border-b-0 xl:px-0 xl:py-4">
                {/* Sidebar toggle */}
                <Button variant="outline" size="icon" onClick={handleToggleSidebar} aria-label="Toggle Sidebar" className="cursor-pointer">
                 <Menu className="h-5 w-5" />
                </Button>

                {/* Application menu (mobile) */}
                <div className="xl:hidden">
                 <Sheet>
                  <SheetTrigger asChild>
                   <Button variant="ghost" size="icon" aria-label="Open menu" >
                    <MoreHorizontal className="h-5 w-5" />
                   </Button>
                 </SheetTrigger>

                 <SheetContent side="top" className="pt-10 ">
                  <div className="flex items-center justify-between gap-4">
                   <div className="flex items-center gap-2">
                    <ThemeToggle />
                   </div>
                    <UserDropdown email={email} />
                   </div>
                  </SheetContent>
                 </Sheet>
                </div>
               </div>

               {/* Right area (desktop only) */}
               <div className="hidden w-full items-center justify-end gap-4 px-5 py-4 xl:flex xl:px-0 xl:py-0">
                <div className="flex items-center gap-2">
                 <ThemeToggle />
                </div>
                <UserDropdown email={email} />
               </div>
              </div>
             </header>
             );
      
      };

export default AppHeader;
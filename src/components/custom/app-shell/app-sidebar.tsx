"use client";

import * as React from "react";
import SidebarBrand from "@/components/custom/sidebar/sidebar-brand";
import SidebarNav from "@/components/custom/sidebar/sidebar-nav-view";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useSidebar } from "@/hooks/sidebar";
import { cn } from "@/lib/utils";

/********************** AppSidebar *****/
export default function AppSidebar() {
  const { isExpanded, isHovered, setIsHovered } = useSidebar();
  const showLabels = isExpanded || isHovered;

  return (
    <TooltipProvider delayDuration={150}>
      <aside
        className={cn(
          "flex h-screen flex-col border-r bg-background no-scrollbar",
          showLabels ? "w-64" : "w-16 sidebar-collapsed",
          "transition-all duration-300 ease-in-out",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        aria-label="Sidebar"
      >
        <SidebarBrand />

        <nav className="min-h-0 flex-1" aria-label="Main navigation">
          <ScrollArea className="h-full">
            <div className="px-2 py-4">
              <SidebarNav />
            </div>
          </ScrollArea>
        </nav>
      </aside>
    </TooltipProvider>
  );
}

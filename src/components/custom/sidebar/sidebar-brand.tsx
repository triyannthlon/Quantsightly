"use client";

import * as React from "react";
import Image from "next/image";
import { useSidebar } from "@/hooks/sidebar"; /* Pour accéder à isExpanded, isHovered, isMobileOpen */

/********************** SidebarBrand *****/
export default function SidebarBrand() {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const showFull = isExpanded || isHovered || isMobileOpen;

  return (
    <div className="flex h-16 shrink-0 items-center justify-center bg-background px-3">
      {showFull ? (
        <>
          <Image
            src="/logo-light.png"
            alt="Company logo"
            width={198}
            height={64}
            priority
            className="h-14 w-auto dark:hidden"
          />
          <Image
            src="/logo-dark.webp"
            alt="Company logo"
            width={198}
            height={64}
            priority
            className="hidden h-14 w-auto dark:block"
          />
        </>
      ) : (
        <>
          <Image
            src="/favicon-1.png"
            alt="Company icon"
            width={64}
            height={64}
            priority
            className="h-8 w-8 dark:hidden"
          />
          <Image
            src="/favicon-2.ico"
            alt="Company icon"
            width={64}
            height={64}
            priority
            className="hidden h-8 w-8 dark:block"
          />
        </>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

import type { NavItem } from "@/lib/navigation/sidebar/sidebar-nav";
import { useSidebarState, useSidebarActions } from "@/hooks/sidebar";
import { useHoverMenu } from "../../../hooks/sidebar/sidebar-hover-menu";

import { cn } from "@/lib/utils";
import {
  sidebarItemVariants,
  sidebarSubItemVariants,
} from "@/lib/navigation/sidebar/sidebar-variants";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getVariant, isActivePath, isAnyChildActive } from "@/lib/helpers/common";

/********************** SidebarSubmenuItem *****/
export default function SidebarSubmenuItem({
  item,
  pathname,
  density = "normal",
}: {
  item: NavItem;
  pathname: string;
  density?: "compact" | "normal";
}) {
  const { isExpanded, isHovered, openSubmenu } = useSidebarState();
  const { toggleSubmenu } = useSidebarActions();

  const showLabels = isExpanded || isHovered;

  const Icon = item.icon;
  const isOpenInline = openSubmenu === item.key;

  const hover = useHoverMenu();
  const open = hover.isOpen(item.key);

  const anyChildActive = isAnyChildActive(pathname, item.children);

  const parentClassName = cn(
    sidebarItemVariants({
      variant: getVariant(anyChildActive, item.tone),
      collapsed: !showLabels,
      density,
    }),
    "menu-hover-gradient",
    "menu-active-indicator",
  );

  if (!showLabels) {
    return (
      <DropdownMenu open={open} onOpenChange={(v) => (v ? hover.open(item.key) : hover.close())}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(parentClassName, "menu-hover-gradient", "menu-active-indicator")}
                aria-label={item.label}
                onMouseEnter={() => hover.open(item.key)}
                onMouseLeave={() => hover.close()}
              >
                <span className="menu-icon-wrap">
                  <Icon className="h-4 w-4 shrink-0" />
                </span>
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          side="right"
          align="start"
          className="min-w-56"
          onMouseEnter={() => hover.open(item.key)}
          onMouseLeave={() => hover.close()}
        >
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {item.label}
          </div>
          {item.children?.map((child) => {
            const childActive = isActivePath(pathname, child.href);

            return (
              <DropdownMenuItem key={child.href} asChild>
                <Link
                  href={child.href}
                  className={cn(
                    "flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none",
                    childActive && "font-medium",
                  )}
                >
                  {child.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Collapsible open={isOpenInline} onOpenChange={() => toggleSubmenu(item.key)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(parentClassName, "menu-hover-gradient", "menu-active-indicator")}
        >
          <span className="flex items-center gap-2">
            <span className="menu-icon-wrap">
              <Icon className="h-4 w-4 shrink-0" />
            </span>
            <span className="menu-label truncate">{item.label}</span>
          </span>
          <ChevronDown
            className={cn(
              "ml-auto h-5 w-5 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)]",
              isOpenInline
                ? "rotate-180 text-brand-500 dark:text-brand-400"
                : "text-muted-foreground",
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="submenu-anim">
        <div className={cn("submenu-inner", density === "compact" ? "pt-2" : "pt-3")}>
          <div
            className={cn(
              "submenu-fade menu-submenu",
              density === "compact" ? "space-y-1.5" : "space-y-2.0",
            )}
          >
            {item.children?.map((child) => {
              const childActive = isActivePath(pathname, child.href);

              const childClassName = cn(
                sidebarSubItemVariants({ variant: getVariant(childActive, child.tone), density }),
                "menu-subitem-dot",
                "menu-active-indicator",
                "menu-hover-gradient",
                childActive && "menu-subitem-dot-active",
              );

              return (
                <Link key={child.href} href={child.href} className="block">
                  <span className={childClassName}>
                    <span className="menu-label truncate">{child.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

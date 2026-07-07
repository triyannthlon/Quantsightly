"use client";

import * as React from "react";
import Link from "next/link";
import type { NavItem } from "@/lib/navigation/sidebar/sidebar-nav";
import { useSidebar } from "@/hooks/sidebar"; /* Pour accéder à isExpanded et isHovered */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { sidebarItemVariants } from "@/lib/navigation/sidebar/sidebar-variants";
import { getVariant, isActivePath } from "@/lib/helpers/common";

/******* SidebarLinkItemBase ******/
function SidebarLinkItemBase({
  item,
  pathname,
  density = "normal",
}: {
  item: NavItem;
  pathname: string;
  density?: "compact" | "normal";
}) {
  const { isExpanded, isHovered } = useSidebar();
  const showLabels = isExpanded || isHovered;

  const Icon = item.icon;
  const disabled = Boolean(item.disabled); /* nœud « Bientôt » : grisé, non-cliquable */
  const active = !disabled && isActivePath(pathname, item.href);

  const className = cn(
    sidebarItemVariants({
      variant: disabled ? "default" : getVariant(active, item.tone),
      collapsed: !showLabels,
      density,
    }),
    !disabled && "menu-hover-gradient",
    !disabled && "menu-active-indicator",
    disabled && "cursor-not-allowed opacity-50",
  );

  // Structure identique aux items cliquables (même DOM, même slot d'icône). Seul
  // le conteneur diffère : <Link> si cliquable, <div> inerte si désactivé.
  const row = (
    <span className={className} aria-disabled={disabled || undefined}>
      <span className="menu-icon-wrap">
        <Icon className="h-4 w-4 shrink-0" />
      </span>
      {showLabels && <span className="menu-label truncate">{item.label}</span>}
      {showLabels && disabled && (
        <span className="ml-auto shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium leading-none uppercase tracking-wide text-muted-foreground">
          Bientôt
        </span>
      )}
    </span>
  );

  const content = disabled ? (
    <div className="block">{row}</div>
  ) : (
    <Link href={item.href!} className="block">
      {row}
    </Link>
  );

  if (showLabels) return content; /* En Expand -> on retourne juste le bouton */

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">
        {disabled ? `${item.label} — bientôt` : item.label}
      </TooltipContent>
    </Tooltip>
  );
}

const SidebarLinkItem = React.memo(
  SidebarLinkItemBase,
  (prev, next) =>
    prev.pathname === next.pathname &&
    prev.item.key === next.item.key &&
    prev.item.href === next.item.href &&
    prev.item.label === next.item.label &&
    prev.item.icon === next.item.icon &&
    prev.item.disabled === next.item.disabled,
);

export default SidebarLinkItem;

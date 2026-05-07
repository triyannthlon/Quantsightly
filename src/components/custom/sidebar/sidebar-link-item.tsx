"use client";

import * as React from "react";
import Link from "next/link";
import type { NavItem } from "@/lib/navigation/sidebar/sidebar-nav";
import { useSidebar } from "@/hooks/sidebar"; /* Pour accéder à isExpanded et isHovered */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { sidebarItemVariants } from "@/lib/navigation/sidebar/sidebar-variants";
import {getVariant, isActivePath} from "@/lib/helpers/common"

/******* SidebarLinkItemBase ******/
function SidebarLinkItemBase({item, pathname,density = "normal",}: { item: NavItem; pathname: string; density?: "compact" | "normal"; })
         {//SidebarLinkItemBase

                    const { isExpanded  , isHovered } = useSidebar();
         const showLabels = isExpanded || isHovered;

         const Icon   =                        item.icon ;
         const active = isActivePath(pathname, item.href); /* le chemin courant est-il actif */

         const className = cn(sidebarItemVariants({  variant: getVariant(active, item.tone),
                                                   collapsed: !showLabels, density,}),"menu-hover-gradient", "menu-active-indicator");

         const content = (
                         <Link href={item.href!} className="block">
                          <span className={className}>
                           <span className="menu-icon-wrap">
                           <Icon className="h-4 w-4 shrink-0" />
                            </span>
                           {showLabels && <span className="menu-label truncate">{item.label}</span>}
                          </span>
                         </Link>
                         );

         if(showLabels) return content; /* En Expand -> on retourne juste le bouton */

         return (
                <Tooltip>
                 <TooltipTrigger asChild>{content}</TooltipTrigger>
                 <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
                );

         }//SidebarLinkItemBase


const SidebarLinkItem = React.memo(SidebarLinkItemBase, (prev, next) =>
                                                         prev.pathname   === next.pathname   &&
                                                         prev.item.key   === next.item.key   &&
                                                         prev.item.href  === next.item.href  &&
                                                         prev.item.label === next.item.label &&
                                                         prev.item.icon  === next.item.icon);

export default SidebarLinkItem;
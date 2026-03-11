
"use client";

import * as React from "react";

import SidebarItem from "./sidebar-item";
import { useSidebarState } from "@/hooks/sidebar";
import {sidebarSectionTitleVariants} from "@/lib/navigation/sidebar/sidebar-variants";
import {NavSection} from "@/lib/navigation/sidebar/sidebar-nav";
import {cn} from "@/lib/utils";



/********************** SidebarSection *****/
export default function SidebarSection({section, pathname, density = "normal",}: { section: NavSection; pathname: string; density?: "compact" | "normal"; })
                        {//SidebarSection

                                                const { isExpanded ,  isHovered } = useSidebarState();
                                     const showLabels = isExpanded || isHovered;
                        const collapsed = !showLabels;

                       return (
                           <div className="space-y-2">
                               {/* Header de section : titre ou séparateur en mode collapsed */}
                               <div  className={cn("flex items-center", density === "compact" ? "h-8" : "h-9")}>
                                {
                                collapsed ? (<div className="flex w-full justify-center">
                                              <div className="h-px w-8 rounded-full bg-border" /> {/* séparateur visuel */}
                                             </div>)
                                           : (<div className={cn(sidebarSectionTitleVariants({ collapsed: false }))}>
                                              {section.title}
                                             </div>)
                                }
                               </div>

                               {/* Items */}
                               <div className="space-y-1">
                                {section.items.map((item) => (
                                                                     <SidebarItem      key={item.key}
                                                                                      item={item}
                                                                                  pathname={pathname}
                                                                                   density={density}/>
                                                                     ))}
                              </div>
                             </div>
                             );

                        }//SidebarSection


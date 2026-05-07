"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import SidebarSection from "./sidebar-section";
import { HoverMenuProvider } from "../../../hooks/sidebar/sidebar-hover-menu";
import {NAV} from "@/lib/navigation/sidebar/sidebar-nav";

/********************** SidebarNav *****/
export default function SidebarNav()
                        {//SidebarNav

                        const pathname = usePathname();

                        return (
                               <HoverMenuProvider>
                                <div className="space-y-6">
                                 {NAV.map((section) => (<SidebarSection key={section.title} section={section} pathname={pathname} density="compact"/>))}
                                </div>
                               </HoverMenuProvider>
                               );

                        }//SidebarNav

"use client";

import React, {useCallback, useEffect, useMemo, useState,} from "react";
import { usePathname } from "next/navigation";
import {NAV} from "@/lib/navigation/sidebar/sidebar-nav";
import {findOpenSubmenuKeyFromPathname} from "@/hooks/sidebar";
import {SidebarState,SidebarActions,SidebarActionsContext, SidebarStateContext } from "@/hooks/sidebar";


const STORAGE_KEY = "sidebar:expanded";

/*********** SidebarProvider *****/
export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({children,}) =>
             {//SidebarProvider

             const [isExpanded  , setIsExpanded  ] = useState(true);
             const [isMobileOpen, setIsMobileOpen] = useState(false);
             const [isMobile    , setIsMobile    ] = useState(false);
             const [isHovered   , setIsHovered   ] = useState(false);
             const [activeItem  , setActiveItem  ] = useState<string | null>(null);
             const [openSubmenu , setOpenSubmenu ] = useState<string | null>(null);

             const pathname = usePathname();

             /* Persistance après refresh */
             useEffect(() => {
                                   try {
                                       const raw = localStorage.getItem(STORAGE_KEY);

                                          /* eslint-disable-next-line react-hooks/set-state-in-effect */
                                          if(raw === "0") setIsExpanded(false);
                                          if(raw === "1") setIsExpanded(true );
                                       } catch {}
                                   }, []);

             /* Détection d'une utilisation d'un mobile avec redimensionnement */
             useEffect(() => {
                                       const mql = window.matchMedia("(max-width: 767px)");

                                       const apply = () => {
                                                                       const mobile = mql.matches;
                                                                 setIsMobile(mobile);
                                                                         if(!mobile) setIsMobileOpen(false);
                                                                 };

                                             apply();

                                                          mql.   addEventListener("change", apply);
                                       return () => mql.removeEventListener("change", apply);
                                       }, []);

             /* Persistance seulement pour l'utilisation d'un ordinateur */
             useEffect(() => {
                                   if (isMobile) return;

                                   try {localStorage.setItem(STORAGE_KEY, isExpanded ? "1" : "0");} catch {}
                                   }, [isExpanded, isMobile]);


             const resetOnRouteChange = useCallback(() => { setIsMobileOpen(false);
                                                                  setIsHovered   (false);
                                                                }, []);

             useEffect(() => {
                                   /* eslint-disable-next-line react-hooks/set-state-in-effect  */
                                   resetOnRouteChange();

                                            const key = findOpenSubmenuKeyFromPathname(NAV, pathname);
                                   setOpenSubmenu(key);

                                   }, [pathname, resetOnRouteChange]);


             const toggleSidebar        = useCallback(()                    => {  setIsExpanded((prev) => !prev);}, []);
             const toggleMobileSidebar  = useCallback(()                    => {setIsMobileOpen((prev) => !prev);}, []);
             const toggleSubmenu        = useCallback((item: string)        => {setOpenSubmenu((prev)=> (prev === item ? null : item));}, []);
             const setOpenSubmenuKey    = useCallback((key: string | null)  => {setOpenSubmenu(key);}, []);

             const   stateValue = useMemo<SidebarState>(() => ({isExpanded: isMobile ? false : isExpanded,
                                                                                               isMobileOpen                             ,
                                                                                               isHovered                                ,
                                                                                               activeItem                               ,
                                                                                               openSubmenu,}), [isExpanded, isMobile, isMobileOpen, isHovered, activeItem, openSubmenu]);

             const actionsValue = useMemo<SidebarActions>(() => ({toggleSidebar                       ,
                                                                                                  toggleMobileSidebar                 ,
                                                                                                  setIsHovered                        ,
                                                                                                  setActiveItem                       ,
                                                                                                  toggleSubmenu                       ,
                                                                                                  setOpenSubmenuKey                   ,
                                                                                                  resetOnRouteChange                  ,}), [toggleSidebar, toggleMobileSidebar, toggleSubmenu, setOpenSubmenuKey, resetOnRouteChange,]);

             return (
                    <SidebarStateContext.Provider value={stateValue}>
                     <SidebarActionsContext.Provider value={actionsValue}>
                     {children}
                     </SidebarActionsContext.Provider>
                    </SidebarStateContext.Provider>);
             };
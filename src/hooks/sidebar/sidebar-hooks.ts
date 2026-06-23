"use client";

import { useContext, useMemo } from "react";
import { SidebarStateContext, SidebarActionsContext } from "./sidebar-context";

/************** useSidebarState *****/
export function useSidebarState() {
  const ctx = useContext(SidebarStateContext);
  if (!ctx) throw new Error("useSidebarState must be used within SidebarProvider");
  return ctx;
}

/************** useSidebarActions *****/
export function useSidebarActions() {
  const ctx = useContext(SidebarActionsContext);
  if (!ctx) throw new Error("useSidebarActions must be used within SidebarProvider");
  return ctx;
}

/************** useSidebar *****/
export function useSidebar() {
  const state = useSidebarState();
  const actions = useSidebarActions();

  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

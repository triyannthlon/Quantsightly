"use client";

import { createContext } from "react";

export type SidebarState = {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  activeItem: string | null;
  openSubmenu: string | null;
};

export type SidebarActions = {
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (isHovered: boolean) => void;
  setActiveItem: (item: string | null) => void;
  toggleSubmenu: (item: string) => void;
  setOpenSubmenuKey: (key: string | null) => void;
  resetOnRouteChange: () => void;
};

export const SidebarStateContext = createContext<SidebarState | undefined>(undefined);
export const SidebarActionsContext = createContext<SidebarActions | undefined>(undefined);

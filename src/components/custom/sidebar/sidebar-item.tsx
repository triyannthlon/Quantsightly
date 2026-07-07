"use client";

import * as React from "react";
import type { NavItem } from "@/lib/navigation/sidebar/sidebar-nav";
import SidebarLinkItem from "./sidebar-link-item";
import SidebarSubmenuItem from "./sidebar-submenu-item";

/********************** SidebarItem *****/
export default function SidebarItem({
  item,
  pathname,
  density = "normal",
}: {
  item: NavItem;
  pathname: string;
  density?: "compact" | "normal";
}) {
  // Un item avec enfants = sous-menu ; sinon feuille (lien cliquable ou nœud
  // désactivé « Bientôt », géré dans SidebarLinkItem).
  if (item.children)
    return <SidebarSubmenuItem item={item} pathname={pathname} density={density} />;
  return <SidebarLinkItem item={item} pathname={pathname} density={density} />;
}

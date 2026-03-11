// sidebar-nav.ts
import { House, ChartNoAxesColumnIcon,Users, Settings,Omega } from "lucide-react";
import React from "react";
import {routes} from "@/lib/navigation/sidebar/route";



export type   NavChild = {
                         label: string;
                          href: string;
                         tone?: "default" | "danger";
                         };

export type    NavItem = {
                               key: string; // stable key
                             label: string;
                             href?: string;
                              icon: React.ComponentType<{ className?: string }>;
                         children?: NavChild[];
                             tone?: "default" | "danger";
                         };

export type NavSection = {
                         title: string;
                         items: NavItem[];
                         };


export const NAV = [
                   {
                   title: "Main",
                   items: [
                          {
                            key: "home"          ,
                          label: "Home"          ,
                           href: routes.dashboard,
                           icon: House           ,
                          },
                          {
                               key: "Item 1",
                             label: "Item 1",
                              icon: ChartNoAxesColumnIcon,
                          children: [
                                    { label: "Page 1", href: routes.items.item_1.page_1 },
                                    { label: "Page 2", href: routes.items.item_1.page_2 },
                                    { label: "Page 3", href: routes.items.item_1.page_3 },
                                    { label: "Page 4", href: routes.items.item_1.page_4 },
                                    { label: "Page 5", href: routes.items.item_1.page_5 },
                                    ],
                          },
                          {
                               key: "Item 2",
                             label: "Item 2",
                              icon: Omega       ,
                          children: [
                                    { label: "Page 1", href: routes.items.item_2.page_1   },
                                    { label: "Page 2", href: routes.items.item_2.page_2   },
                                    { label: "Page 3", href: routes.items.item_2.page_3   },
                                    ],
                          },
                          ],
                   },

                   {
                   title: "Management",
                   items: [
                          {
                            key: "users"                ,
                          label: "Users"                ,
                           href: routes.management.users,
                           icon: Users                  ,
                          },
                          {
                            key: "settings",
                          label: "Settings",
                           href: routes.management.settings,
                           icon: Settings,
                          },
                          ],
                  },
                  ];


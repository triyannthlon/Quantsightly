// sidebar-nav.ts
import { House, CandlestickChart, ChartNoAxesColumnIcon, Users, Settings } from "lucide-react";
import React from "react";
import { routes } from "@/lib/navigation/sidebar/route";


export type   NavChild = {
                         label: string;
                          href: string;
                         tone?: "default" | "danger";
                         };

export type    NavItem = {
                               key: string;
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
                   title: "Principal",
                   items: [
                          {
                            key: "home"          ,
                          label: "Accueil"       ,
                           href: routes.dashboard,
                           icon: House           ,
                          },
                          {
                               key: "screener"        ,
                             label: "Screener"        ,
                              icon: CandlestickChart   ,
                          children: [
                                    { label: "Actions"       , href: routes.screener.stock    },
                                    { label: "ETF"           , href: routes.screener.etf      },
                                    { label: "Cryptomonnaies", href: routes.screener.crypto   },
                                    { label: "Devises"       , href: routes.screener.currency },
                                    ],
                          },
                          {
                               key: "item_1",
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
                          ],
                   },

                   {
                   title: "Gestion",
                   items: [
                          {
                            key: "users"                ,
                          label: "Utilisateurs"         ,
                           href: routes.management.users,
                           icon: Users                  ,
                          },
                          {
                            key: "settings"                ,
                          label: "Paramètres"              ,
                           href: routes.management.settings,
                           icon: Settings                  ,
                          },
                          ],
                  },
                  ];

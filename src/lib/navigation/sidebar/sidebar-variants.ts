import { cva } from "class-variance-authority";

/*********** sidebarItemVariants *****/
export const sidebarItemVariants = cva( "menu-item relative select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
             {//sidebarItemVariants

                    variants: {
                                variant: {
                                         default: "menu-item-inactive"                                             ,
                                          active: "menu-item-active"                                               ,
                                          danger: "text-destructive hover:bg-destructive/10 hover:text-destructive",
                                         },
                                density: {
                                         compact: "min-h-8 px-2 py-1.5 text-[13px]",
                                          normal: "min-h-10 px-3 py-2 text-sm",
                                         },
                              collapsed: {
                                          true: "justify-center"     ,
                                         false: "justify-start gap-2",
                                         },
                              },
             defaultVariants: {
                                variant: "default",
                                density: "normal" ,
                              collapsed: false    ,
                              },

             });//sidebarItemVariants


/*********** sidebarSectionTitleVariants *****/
export const sidebarSectionTitleVariants = cva("px-2 pb-2 text-xs font-semibold uppercase text-muted-foreground",
             {//sidebarSectionTitleVariants

                    variants: {
                              collapsed: {
                                         true: "hidden"   ,
                                        false: "px-3",
                              },

                     density: {
                              compact: "text-[11px]",
                               normal: "text-xs",
                              },

                              },
             defaultVariants: {
                                density: "normal",
                              collapsed: false   ,
                              },

             });//sidebarSectionTitleVariants


/*********** sidebarSubItemVariants *****/
export const sidebarSubItemVariants = cva("menu-dropdown-item select-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
             {//sidebarSubItemVariants

                    variants: {
                              variant: {
                                       default: "menu-dropdown-item-inactive"                                    ,
                                        active: "menu-dropdown-item-active"                                      ,
                                        danger: "text-destructive hover:bg-destructive/10 hover:text-destructive",
                                       },
                              density: {
                                       compact: "min-h-8 pr-2 py-1.5 text-[13px]",
                                        normal: "min-h-9 pr-3 py-2 text-sm",
                                       },
                              },
             defaultVariants: {
                              variant: "default",
                              density: "normal" ,
                              },

             });//sidebarSubItemVariants
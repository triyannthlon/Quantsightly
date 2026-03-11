"use client";

import React from "react";

import { AnimatePresence, motion } from "framer-motion";

/********************** DashboardMotionLayout *****/
export default function DashboardMotionLayout({children,}: { children: React.ReactNode;})
                        {//DashboardMotionLayout

                        return (
                               <AnimatePresence mode="wait">
                                <motion.div     key={typeof window !== "undefined" ? window.location.pathname : ""}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                               exit={{ opacity: 0, y: -10 }}
                                         transition={{ duration: 0.25, ease: "easeOut" }}
                                          className="min-h-screen w-full bg-background">
                                 {children}
                                </motion.div>
                               </AnimatePresence>
                               );

                              }//DashboardMotionLayout

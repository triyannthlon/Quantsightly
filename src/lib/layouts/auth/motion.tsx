"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import React from "react";

/********************** AuthMotionLayout *****/
export default function AuthMotionLayout({children,}: { children: React.ReactNode; })
                        {//AuthMotionLayout

                        const pathname = usePathname();

                        return (
                               <AnimatePresence mode="wait">
                                <motion.div        key={pathname}
                                               initial={{ opacity: 0, y: 10 }}
                                               animate={{ opacity: 1, y: 0 }}
                                                  exit={{ opacity: 0, y: -10 }}
                                            transition={{ duration: 0.25, ease: "easeOut" }}
                                             className="w-full flex justify-center"> {children}</motion.div>
                               </AnimatePresence>
                               );

                        }//AuthMotionLayout

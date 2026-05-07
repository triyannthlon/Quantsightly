import React from "react";

import AuthMotionLayout from "@/lib/layouts/auth/motion";
import {ThemeToggle} from "@/components/custom/header/theme-toggle";

/********************** AuthLayout *****/
export default function AuthLayout({children,}: { children: React.ReactNode; })
                                  {//AuthLayout

                                  return (
                                         <main className="min-h-screen flex items-center justify-center px-4 no-scrollbar">
                                          <div className="w-full max-w-lg">
                                           <AuthMotionLayout>

                                           {children}

                                           <div className="fixed bottom-4 right-4 z-50"><ThemeToggle /></div>

                                           </AuthMotionLayout>
                                          </div>
                                         </main>);


                                  }//AuthLayout




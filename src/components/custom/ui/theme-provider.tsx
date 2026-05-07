"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/************** ThemeProvider *****/
export function ThemeProvider({children,...props}: React.ComponentProps<typeof NextThemesProvider>)
                {//ThemeProvider

                return <NextThemesProvider {...props}>{children}</NextThemesProvider>

                }//ThemeProvider
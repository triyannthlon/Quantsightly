
import React from "react";
import {Metadata} from "next";
import { Noto_Sans_KR } from 'next/font/google';
import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "@/components/custom/ui/theme-provider"
import {ThemeToggle} from "@/components/custom/header/theme-toggle";
import { Toaster } from "@/components/ui/sonner";

import "@/app/globals.css";


const notoSansKR = Noto_Sans_KR({
    weight: ['300', '400', '500', '700'],
    subsets: ['latin'],
    variable: '--font-noto-sans-kr',
    display: 'swap',
});


export const metadata: Metadata = {
    title: "Quantsightly",
    icons: [
        {
            rel: 'icon',
            type: 'image/x-icon',
            url: '/favicon-1.ico',
            media: '(prefers-color-scheme: light)',
        },
        {
            rel: 'icon',
            type: 'image/x-icon',
            url: '/favicon-2.ico',
            media: '(prefers-color-scheme: dark)',
        },
    ],
}

/********************** HomeLayout *****/
export default function HomeLayout({children,}: Readonly<{ children: React.ReactNode; }>)
                        {//HomeLayout

                        return (
                              <html lang="en" className={`${notoSansKR.variable}`} suppressHydrationWarning>
                               <body className={` antialiased`}>

                               <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                                <NextTopLoader showSpinner={true} height={6} color="#000000" />
                                 <Toaster richColors position="top-right" />

                                   {children}

                               </ThemeProvider>
                               </body>
                              </html>
                              );

                        }//HomeLayout



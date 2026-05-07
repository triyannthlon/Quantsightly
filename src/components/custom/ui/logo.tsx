'use client'

import Image from 'next/image'
import Link from 'next/link'

/********************** Logo *****/
export default function Logo()
       {//Logo

       return (
              <><Image src="/logo-light.png" alt="Logo clair"  width={198} height={64} className="dark:hidden"       priority/>
                <Image src="/logo-dark.webp" alt="Logo sombre" width={198} height={64} className="hidden dark:block" priority/></>
              );
      }//Logo

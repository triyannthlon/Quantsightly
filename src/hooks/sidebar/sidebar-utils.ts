import {NavSection} from "@/lib/navigation/sidebar/sidebar-nav";


/******* matchPath *****/
function matchPath(pathname: string, href: string)
         {//matchPath

         return pathname === href || pathname.startsWith(href + "/");

         }//matchPath


/************** findOpenSubmenuKeyFromPathname *****/
export function findOpenSubmenuKeyFromPathname(nav: NavSection[], pathname: string): string | null /* Retourne la key du parent dont un enfant est actif, sinon null */
                {//findOpenSubmenuKeyFromPathname

                for(const section of nav)
                   {
                   for(const item of section.items)
                      {
                      if(!item.children?.length) continue;
                      if( item.children.some((c) => matchPath(pathname, c.href))) {return item.key;}
                      }
                   }
                                                                                           return null;

                }//findOpenSubmenuKeyFromPathname

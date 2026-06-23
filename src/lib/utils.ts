import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* Note importante : le fichier utils.ts doit être dans le répertoire @/lib car les composants Shadcn l'utilise */

/* Remarque :
twMerge supprime automatiquement les conflits Tailwind

cn("px-2", "px-4") // => "px-4"
cn("text-sm", "text-lg") // => "text-lg"
cn("bg-white", condition && "bg-black") // => "bg-black" si condition true

Ça règle un problème que cx() ne règle pas : cx concatène, mais ne résout pas les conflits.

 */

/************** cn *****/
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

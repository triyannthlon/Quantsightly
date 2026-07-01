import { NAV } from "@/lib/navigation/sidebar/sidebar-nav";

/* Tous les hrefs du nav (items + enfants) — sert à départager les routes sœurs :
   une route index (ex. /comparaisons) préfixe de ses sœurs ne doit pas rester
   active quand on est sur une route plus spécifique (ex. /comparaisons/quadrants). */
const NAV_HREFS: string[] = NAV.flatMap((s) =>
  s.items.flatMap((it) => [
    ...(it.href ? [it.href] : []),
    ...(it.children?.map((c) => c.href) ?? []),
  ]),
);

/******* getVariant *****/
export function getVariant(
  active: boolean,
  tone?: "default" | "danger",
): "default" | "active" | "danger" {
  if (active) return "active";
  if (tone === "danger") return "danger";
  return "default";
}

/******* isActivePath *****/
export function isActivePath(
  pathname: string,
  href?: string /* Savoir si le lien correspond à la page actuelle */,
) {
  if (!href) return false; /* Sécurité */
  if (pathname === href) return true; /* Match exact = toujours actif */
  if (href === "/home") return false; /* /home = exact seulement */
  if (!pathname.startsWith(href + "/")) return false;

  /* Match par préfixe (page de détail d'une section) : actif SEULEMENT si aucune
     route sœur plus spécifique ne matche déjà — sinon une route index comme
     /comparaisons resterait active sur /comparaisons/quadrants. */
  const hasMoreSpecific = NAV_HREFS.some(
    (h) => h.length > href.length && (pathname === h || pathname.startsWith(h + "/")),
  );
  return !hasMoreSpecific;
}

/******* isAnyChildActive ******/
export function isAnyChildActive(pathname: string, children?: { href: string }[]) {
  if (!children?.length) return false;
  return children.some((c) => isActivePath(pathname, c.href));
}

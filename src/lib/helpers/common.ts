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
  if (href === "/home")
    return pathname === "/home"; /* Évite que / soit actif pour toutes les routes */

  return (
    pathname === href || pathname.startsWith(href + "/")
  ); /* Permet que /Dashboard /Dashboard/... soient tous considérés actifs pour /Dashboard */
}

/******* isAnyChildActive ******/
export function isAnyChildActive(pathname: string, children?: { href: string }[]) {
  if (!children?.length) return false;
  return children.some((c) => isActivePath(pathname, c.href));
}

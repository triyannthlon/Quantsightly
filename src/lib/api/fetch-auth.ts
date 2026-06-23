/**
 * Wrapper de `fetch` qui gère automatiquement le rafraîchissement de session.
 *
 * Comportement :
 *  - Si la réponse est 401 → tente un POST /api/auth/refresh
 *  - Si refresh OK → réessaie la requête d'origine (avec les nouveaux cookies auth)
 *  - Si refresh KO → redirige vers / et throw "session_expired"
 *  - Sinon → renvoie la Response brute (l'appelant fait .json() / .ok / etc.)
 *
 * À utiliser pour TOUS les appels client vers les routes /api/me/* (auth requise).
 * Ne pas l'utiliser pour :
 *   - les routes publiques (/api/auth/send-code, /api/search…)
 *   - le backend C++ via /qs-api (auth gérée séparément)
 */
export async function fetchAuth(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let res = await fetch(input, init);

  if (res.status === 401) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST" });
    if (!refreshed.ok) {
      if (typeof window !== "undefined") window.location.href = "/";
      throw new Error("session_expired");
    }
    res = await fetch(input, init);
  }

  return res;
}

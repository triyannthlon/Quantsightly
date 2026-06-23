/******************** apiFetch *****/
export async function apiFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  let response = await fetch(input, init);

  if (response.status === 401) {
    const refresh = await fetch("/api/auth/refresh", { method: "POST" });

    if (!refresh.ok) {
      throw new Error("Session expirée");
    }

    response = await fetch(input, init);
  }

  const json = await response.json();
  if (!json.success) throw new Error(json.error);

  return json.data as T;
}

"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";

export type Session = {
  id: string;
  userAgent?: string | null;
  ip?: string | null;
  createdAt: string;
};

/************** useSessions *****/
export function useSessions() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  /* Chargement de la session avec refresh silencieux */

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);

      const data = await apiFetch<{ session: Session }>("/api/auth/sessions");

      setSession(data.session);
    } catch (err) {
      toast.dismiss();
      if (err instanceof Error) toast.error(err.message);
      else toast.error("Erreur inconnue");

      router.push("/");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  return { session, loading, reload: loadSession };
}

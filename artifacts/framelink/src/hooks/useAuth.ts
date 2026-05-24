import { useState, useEffect, useCallback } from "react";
import { op } from "@/lib/analytics";

export interface AuthUser {
  id: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data: AuthUser = await res.json();
        op.identify({ profileId: data.id, email: data.email });
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    op.track("user_logout");
    op.clear();
    setUser(null);
  }, []);

  return { user, isLoading, signOut, refetch: check };
}

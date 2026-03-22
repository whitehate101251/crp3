"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/types";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("No active session");
        }
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        setUser(data.user ?? null);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        setUser(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return {
    user,
    role: user?.role ?? null,
    loading,
    error,
  };
}

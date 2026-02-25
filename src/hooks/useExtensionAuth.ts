"use client";

import { useEffect, useState } from "react";
import { syncTokenFromCookie } from "../lib/auth";

export function useExtensionAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadToken = async () => {
      try {
        const value = await syncTokenFromCookie();
        if (isActive) {
          setToken(value);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadToken();

    return () => {
      isActive = false;
    };
  }, []);

  return {
    token,
    isAuthenticated: Boolean(token),
    isLoading,
  };
}

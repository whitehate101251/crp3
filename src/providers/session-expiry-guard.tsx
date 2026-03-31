"use client";

import { useEffect } from "react";
import { toast } from "sonner";

declare global {
  interface Window {
    __erpFetchPatched?: boolean;
    __erpSessionRedirecting?: boolean;
  }
}

export function SessionExpiryGuard() {
  useEffect(() => {
    if (typeof window === "undefined" || window.__erpFetchPatched) {
      return;
    }

    window.__erpFetchPatched = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      try {
        const input = args[0];
        const requestUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        const isApiRequest = requestUrl.includes("/api/");
        const isLoginOrLogoutRequest = requestUrl.includes("/api/auth/login") || requestUrl.includes("/api/auth/logout");
        const isOnLoginPage = window.location.pathname === "/login";

        if (
          response.status === 401
          && isApiRequest
          && !isLoginOrLogoutRequest
          && !isOnLoginPage
          && !window.__erpSessionRedirecting
        ) {
          window.__erpSessionRedirecting = true;
          toast.error("Session expired. Please login again.");
          window.setTimeout(() => {
            window.location.assign("/login");
          }, 150);
        }
      } catch {
        // no-op
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
      window.__erpFetchPatched = false;
      window.__erpSessionRedirecting = false;
    };
  }, []);

  return null;
}

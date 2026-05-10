import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { apiClient, ApiError } from "@/lib/api";

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STORAGE_KEY = "dashboard-auth-refreshed";

export function AuthTokenRefresher() {
  const navigate = useNavigate();

  useEffect(() => {
    const refresh = async () => {
      const lastRefreshed = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();

      if (lastRefreshed && now - Number(lastRefreshed) < REFRESH_INTERVAL_MS) {
        return;
      }

      try {
        await apiClient.post("/auth/refresh");
        localStorage.setItem(STORAGE_KEY, String(now));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          navigate({ to: "/login" });
        }
        // Otherwise silent — the next page load will retry.
      }
    };

    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [navigate]);

  return null;
}

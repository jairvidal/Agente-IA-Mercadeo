import { useQuery } from "@tanstack/react-query";

import { fetchSession, type Session } from "../api/auth-api";

export type { Session };

export const sessionQueryOptions = {
  queryKey: ["session"] as const,
  queryFn: fetchSession,
  staleTime: 5 * 60_000,
};

export function useSession() {
  return useQuery(sessionQueryOptions);
}

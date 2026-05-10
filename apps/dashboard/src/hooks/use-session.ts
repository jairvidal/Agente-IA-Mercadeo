import { useQuery } from "@tanstack/react-query";

export interface Session {
  id: string;
  email: string;
  name: string | null;
}

const STUB_SESSION: Session = {
  id: "dev",
  email: "dev@sidoc.co",
  name: "Dev User",
};

// TODO: replace stub with real call to `${VITE_API_URL}/auth/session`
// once the backend exposes the endpoint.
async function fetchSession(): Promise<Session | null> {
  return STUB_SESSION;
}

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
  });
}

import { redirect } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { sessionQueryOptions } from "../hooks/use-session";

interface GuardContext {
  context: { queryClient: QueryClient };
}

export async function requireSession({ context }: GuardContext) {
  const session = await context.queryClient.ensureQueryData(sessionQueryOptions);
  if (!session) {
    throw redirect({ to: "/login" });
  }
}

export async function requireAnonymous({ context }: GuardContext) {
  const session = await context.queryClient
    .ensureQueryData(sessionQueryOptions)
    .catch(() => null);
  if (session) {
    throw redirect({ to: "/dashboard" });
  }
}

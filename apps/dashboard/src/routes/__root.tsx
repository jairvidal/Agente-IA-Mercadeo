import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { lazy, Suspense } from "react";

import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "@/components/ui/toast";

interface RouterContext {
  queryClient: QueryClient;
}

const TanStackRouterDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/router-devtools").then((m) => ({ default: m.TanStackRouterDevtools })),
    )
  : () => null;

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null;

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <Outlet />
      <Toaster />
      {import.meta.env.DEV && (
        <Suspense>
          <TanStackRouterDevtools position="bottom-right" />
          <ReactQueryDevtools buttonPosition="bottom-left" />
        </Suspense>
      )}
    </ThemeProvider>
  );
}

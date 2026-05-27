import type { ReactNode } from "react";
import { Search, Users } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";

interface ClientsEmptyProps {
  variant?: "empty" | "no-results";
  action?: ReactNode;
}

export function ClientsEmpty({ variant = "empty", action }: ClientsEmptyProps) {
  if (variant === "no-results") {
    return (
      <EmptyState
        icon={<Search />}
        title="Sin resultados"
        description="No encontramos clientes que coincidan con tu búsqueda."
        action={action}
      />
    );
  }

  return (
    <EmptyState
      icon={<Users />}
      title="Aún no hay clientes"
      description="Agrega tu primer cliente para empezar."
      action={action}
    />
  );
}

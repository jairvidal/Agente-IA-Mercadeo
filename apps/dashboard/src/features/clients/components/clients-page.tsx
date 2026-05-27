import { useState } from "react";
import { Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

import { useClients } from "../hooks/use-clients";
import { useDeleteClient } from "../hooks/use-delete-client";
import type { Client } from "../schemas/client-schema";

import { ClientFormDialog } from "./client-form-dialog";
import { ClientsEmpty } from "./clients-empty";
import { ClientsSkeleton } from "./clients-skeleton";
import { ClientsTable } from "./clients-table";

export function ClientsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { data: clients = [], isLoading } = useClients();
  const deleteClient = useDeleteClient();

  const handleDelete = (client: Client) => {
    // TODO: Replace window.confirm with custom delete dialog (commit 5 of HU-FE-005)
    if (!window.confirm(`¿Eliminar a ${client.name}?`)) return;
    deleteClient.mutate(client.id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users />}
        title="Clientes"
        description="Gestiona tus clientes"
        action={
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        }
      />

      {isLoading ? (
        <ClientsSkeleton />
      ) : clients.length === 0 ? (
        <ClientsEmpty />
      ) : (
        <ClientsTable data={clients} onDelete={handleDelete} />
      )}

      <ClientFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}

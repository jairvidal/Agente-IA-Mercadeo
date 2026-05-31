import { useMemo, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import type { PaginationState, SortingState } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

import { useClients } from "../hooks/use-clients";
import { useDeleteClient } from "../hooks/use-delete-client";
import { searchClients } from "../lib/search-clients";
import type { Client } from "../schemas/client-schema";

import { ClientDeleteDialog } from "./client-delete-dialog";
import { ClientFormDialog } from "./client-form-dialog";
import { ClientsEmpty } from "./clients-empty";
import { ClientsSkeleton } from "./clients-skeleton";
import { ClientsTable } from "./clients-table";

export function ClientsPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const { data: clients = [], isLoading } = useClients();
  const deleteClient = useDeleteClient();

  const filteredClients = useMemo(
    () => searchClients(clients, searchQuery),
    [clients, searchQuery],
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
  };

  const handleDelete = (client: Client) => {
    setDeletingClient(client);
  };

  const handleConfirmDelete = () => {
    if (!deletingClient) return;
    deleteClient.mutate(deletingClient.id, {
      onSettled: () => setDeletingClient(null),
    });
  };

  const handleFormDialogChange = (open: boolean) => {
    if (!open) {
      setCreateDialogOpen(false);
      setEditingClient(null);
    }
  };

  const handleDeleteDialogChange = (open: boolean) => {
    if (!open) {
      setDeletingClient(null);
    }
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar por nombre, empresa o email…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
          aria-label="Buscar clientes"
        />
      </div>

      {isLoading ? (
        <ClientsSkeleton />
      ) : clients.length === 0 ? (
        <ClientsEmpty variant="empty" />
      ) : filteredClients.length === 0 ? (
        <ClientsEmpty variant="no-results" />
      ) : (
        <ClientsTable
          data={filteredClients}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={pagination}
          onPaginationChange={setPagination}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      <ClientFormDialog
        open={createDialogOpen || editingClient !== null}
        onOpenChange={handleFormDialogChange}
        client={editingClient ?? undefined}
      />

      <ClientDeleteDialog
        client={deletingClient}
        onOpenChange={handleDeleteDialogChange}
        onConfirm={handleConfirmDelete}
        isPending={deleteClient.isPending}
      />
    </div>
  );
}

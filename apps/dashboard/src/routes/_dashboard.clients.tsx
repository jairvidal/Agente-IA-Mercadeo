import { type FormEvent, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { apiClient, ApiError } from "@/lib/api";

interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
  _count: { quotes: number };
}

interface ClientPayload {
  name: string;
  email: string;
  company: string;
  phone: string;
}

export const Route = createFileRoute("/_dashboard/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClientPayload>({
    name: "",
    email: "",
    company: "",
    phone: "",
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      try {
        return await apiClient.get<Client[]>("/clients");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return [];
        }
        throw err;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: ClientPayload) => apiClient.post<Client>("/clients", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setForm({ name: "", email: "", company: "", phone: "" });
      toast({ title: "Cliente creado", variant: "success" });
    },
    onError: () => toast({ title: "Error al crear cliente", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente eliminado" });
    },
  });

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form);
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar este cliente?")) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Users />}
        title="Clientes"
        description="Gestiona tus clientes"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 mt-2">
                <Input
                  placeholder="Nombre *"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <Input
                  placeholder="Empresa"
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
                <Input
                  placeholder="Teléfono"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creando…" : "Crear"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Aún no hay clientes"
          description="Agrega tu primer cliente para empezar."
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3 hidden sm:table-cell">Empresa</th>
                <th className="px-4 py-3 hidden md:table-cell">Email</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Cotizaciones</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {c.company ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {c.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === "ACTIVE" ? "success" : "default"}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c._count.quotes}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(c.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

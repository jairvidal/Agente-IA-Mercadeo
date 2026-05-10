import { type FormEvent, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BadgeVariants } from "@/components/ui/badge.variants";
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

type QuoteStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED";

interface Quote {
  id: string;
  title: string;
  amount: number | null;
  status: QuoteStatus;
  client: { id: string; name: string } | null;
  createdAt: string;
}

interface QuotePayload {
  title: string;
  amount?: number;
}

const statusVariant: Record<QuoteStatus, BadgeVariants["variant"]> = {
  DRAFT: "default",
  SENT: "blue",
  APPROVED: "success",
  REJECTED: "error",
  EXPIRED: "warning",
};

export const Route = createFileRoute("/_dashboard/quotes")({
  component: QuotesPage,
});

function QuotesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "" });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["quotes"],
    queryFn: async () => {
      try {
        return await apiClient.get<Quote[]>("/quotes");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 501)) {
          return [];
        }
        throw err;
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: QuotePayload) => apiClient.post<Quote>("/quotes", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setOpen(false);
      setForm({ title: "", amount: "" });
      toast({ title: "Cotización creada", variant: "success" });
    },
    onError: () => toast({ title: "Error al crear cotización", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Cotización eliminada" });
    },
  });

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      title: form.title,
      amount: form.amount ? parseFloat(form.amount) : undefined,
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("¿Eliminar esta cotización?")) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileText />}
        title="Cotizaciones"
        description="Gestiona tus cotizaciones"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Nueva cotización
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva cotización</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-3 mt-2">
                <Input
                  placeholder="Título *"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  placeholder="Monto"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  step="0.01"
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
      ) : quotes.length === 0 ? (
        <EmptyState
          icon={<FileText />}
          title="Aún no hay cotizaciones"
          description="Crea tu primera cotización para empezar."
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3 hidden sm:table-cell">Cliente</th>
                <th className="px-4 py-3 hidden md:table-cell">Monto</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{q.title}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {q.client?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {q.amount != null ? `$${q.amount.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant[q.status]}>{q.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(q.id)}
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

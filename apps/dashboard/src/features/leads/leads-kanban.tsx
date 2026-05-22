import { type FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  KanbanBoard,
  type KanbanColumnDef,
  type KanbanItem,
} from "@/components/kanban/kanban-board";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";

const LEAD_COLUMNS: KanbanColumnDef[] = [
  { id: "NEW", label: "New", color: "bg-blue-400" },
  { id: "CONTACTED", label: "Contacted", color: "bg-yellow-400" },
  { id: "QUALIFIED", label: "Qualified", color: "bg-purple-400" },
  { id: "PROPOSAL", label: "Proposal", color: "bg-cyan-400" },
  { id: "WON", label: "Won", color: "bg-emerald-500" },
  { id: "LOST", label: "Lost", color: "bg-red-400" },
];

const LEAD_SOURCES = ["Website", "Referral", "LinkedIn", "Cold Call"] as const;

type LeadStatus = (typeof LEAD_COLUMNS)[number]["id"];

interface LeadPayload {
  name: string;
  company: string;
  source: string;
}

const emptyForm: LeadPayload = { name: "", company: "", source: "" };

const selectClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

interface LeadsKanbanProps {
  leads: KanbanItem[];
}

export function LeadsKanban({ leads }: LeadsKanbanProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<LeadPayload>(emptyForm);

  const [editingLead, setEditingLead] = useState<KanbanItem | null>(null);
  const [editForm, setEditForm] = useState<LeadPayload>(emptyForm);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["leads"] });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/leads/${id}`, { status }),
    onSuccess: invalidate,
    onError: () =>
      toast({ title: "No se pudo mover el lead", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (payload: LeadPayload) =>
      apiClient.post<KanbanItem>("/leads", { ...payload, status: "NEW" satisfies LeadStatus }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setCreateForm(emptyForm);
      toast({ title: "Lead creado", variant: "success" });
    },
    onError: () => toast({ title: "Error al crear lead", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LeadPayload }) =>
      apiClient.patch(`/leads/${id}`, payload),
    onSuccess: () => {
      invalidate();
      setEditingLead(null);
      toast({ title: "Lead actualizado", variant: "success" });
    },
    onError: () => toast({ title: "Error al actualizar lead", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/leads/${id}`),
    onSuccess: () => {
      invalidate();
      setConfirmDeleteId(null);
      setEditingLead(null);
      toast({ title: "Lead eliminado" });
    },
    onError: () => toast({ title: "Error al eliminar lead", variant: "destructive" }),
  });

  const handleStatusChange = async (id: string, status: string) => {
    await statusMutation.mutateAsync({ id, status });
  };

  const handleItemClick = (id: string) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    setEditingLead(lead);
    setEditForm({
      name: lead.name,
      company: lead.company ?? "",
      source: lead.source ?? "",
    });
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    createMutation.mutate(createForm);
  };

  const handleUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    updateMutation.mutate({ id: editingLead.id, payload: editForm });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuevo lead
        </Button>
      </div>

      <KanbanBoard
        columns={LEAD_COLUMNS}
        items={leads}
        onStatusChange={handleStatusChange}
        onItemClick={handleItemClick}
      />

      {/* Crear lead */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo lead</DialogTitle>
            <DialogDescription>Quedará en la columna "New" por defecto.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 mt-2">
            <Input
              placeholder="Nombre *"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
              autoFocus
            />
            <Input
              placeholder="Empresa"
              value={createForm.company}
              onChange={(e) => setCreateForm({ ...createForm, company: e.target.value })}
            />
            <select
              value={createForm.source}
              onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
              className={selectClass}
              aria-label="Fuente"
            >
              <option value="">— Fuente —</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creando…" : "Crear lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar lead */}
      <Dialog open={!!editingLead} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar lead</DialogTitle>
            <DialogDescription>
              Para cambiar la etapa, arrastra la tarjeta entre columnas.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-3 mt-2">
            <Input
              placeholder="Nombre *"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
              autoFocus
            />
            <Input
              placeholder="Empresa"
              value={editForm.company}
              onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
            />
            <select
              value={editForm.source}
              onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
              className={selectClass}
              aria-label="Fuente"
            >
              <option value="">— Fuente —</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <DialogFooter className="sm:justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => editingLead && setConfirmDeleteId(editingLead.id)}
                className={cn("text-destructive hover:text-destructive hover:bg-destructive/10")}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar lead?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDeleteId && deleteMutation.mutate(confirmDeleteId)}
            >
              {deleteMutation.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

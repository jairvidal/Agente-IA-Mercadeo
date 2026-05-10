import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  KanbanBoard,
  type KanbanColumnDef,
  type KanbanItem,
} from "@/components/kanban/kanban-board";
import { apiClient } from "@/lib/api";

const LEAD_COLUMNS: KanbanColumnDef[] = [
  { id: "NEW", label: "New", color: "bg-blue-400" },
  { id: "CONTACTED", label: "Contacted", color: "bg-yellow-400" },
  { id: "QUALIFIED", label: "Qualified", color: "bg-purple-400" },
  { id: "LOST", label: "Lost", color: "bg-red-400" },
  { id: "CONVERTED", label: "Converted", color: "bg-emerald-500" },
];

interface LeadsKanbanProps {
  leads: KanbanItem[];
}

export function LeadsKanban({ leads }: LeadsKanbanProps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.patch(`/leads/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const handleStatusChange = async (id: string, status: string) => {
    await mutation.mutateAsync({ id, status });
  };

  return (
    <KanbanBoard columns={LEAD_COLUMNS} items={leads} onStatusChange={handleStatusChange} />
  );
}

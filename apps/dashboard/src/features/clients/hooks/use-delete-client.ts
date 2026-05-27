import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/toast";

import { deleteClient } from "../api/clients-api";

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente eliminado", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error al eliminar cliente", variant: "destructive" });
    },
  });
}

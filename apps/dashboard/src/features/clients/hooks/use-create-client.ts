import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/toast";

import { createClient, type ClientCreatePayload } from "../api/clients-api";

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (payload: ClientCreatePayload) => createClient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast({ title: "Cliente creado", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error al crear cliente", variant: "destructive" });
    },
  });
}

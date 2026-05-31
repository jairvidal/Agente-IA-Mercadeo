import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useToast } from "@/components/ui/toast";

import { updateClient, type ClientUpdatePayload } from "../api/clients-api";
import type { Client } from "../schemas/client-schema";

interface UpdateClientArgs {
  id: string;
  payload: ClientUpdatePayload;
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, payload }: UpdateClientArgs) => updateClient(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<Client[]>(["clients"], (old) =>
        old?.map((c) => (c.id === updated.id ? updated : c)) ?? [],
      );
      toast({ title: "Cliente actualizado", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error al actualizar cliente", variant: "destructive" });
    },
  });
}

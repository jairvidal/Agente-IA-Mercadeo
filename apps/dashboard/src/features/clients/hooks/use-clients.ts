import { useQuery } from "@tanstack/react-query";

import { fetchClients } from "../api/clients-api";

export const clientsQueryOptions = {
  queryKey: ["clients"] as const,
  queryFn: fetchClients,
};

export function useClients() {
  return useQuery(clientsQueryOptions);
}

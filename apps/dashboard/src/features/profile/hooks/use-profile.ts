import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchProfile, updateProfile } from "../api/profile-api";
import type { Profile } from "../schemas/profile-schema";

export const profileQueryOptions = {
  queryKey: ["profile"] as const,
  queryFn: fetchProfile,
};

export function useProfile() {
  return useQuery(profileQueryOptions);
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      queryClient.setQueryData<Profile>(["profile"], updated);
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchProfile, updateProfile, type UpdateProfilePayload } from "../api/profile-api";
import type { Profile } from "../schemas/profile-schema";

const PROFILE_QUERY_KEY = ["profile"] as const;

export const profileQueryOptions = {
  queryKey: PROFILE_QUERY_KEY,
  queryFn: fetchProfile,
};

export function useProfile() {
  return useQuery(profileQueryOptions);
}

interface UpdateProfileContext {
  previous: Profile | undefined;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<Profile, Error, UpdateProfilePayload, UpdateProfileContext>({
    mutationFn: updateProfile,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: PROFILE_QUERY_KEY });
      const previous = queryClient.getQueryData<Profile>(PROFILE_QUERY_KEY);
      if (previous) {
        queryClient.setQueryData<Profile>(PROFILE_QUERY_KEY, { ...previous, name: payload.name });
      }
      return { previous };
    },
    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Profile>(PROFILE_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    },
  });
}

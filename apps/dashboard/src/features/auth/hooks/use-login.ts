import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { ApiError } from "@/lib/api";

import { login } from "../api/auth-api";
import type { LoginInput } from "../schemas/login-schema";

export function useLogin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate({ to: "/dashboard" });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) {
        setFormError("Credenciales inválidas. Verifica tu email y contraseña.");
        return;
      }
      setFormError("No pudimos iniciar sesión. Intenta de nuevo.");
    },
  });

  const submit = async (input: LoginInput) => {
    setFormError(null);
    try {
      await mutation.mutateAsync(input);
    } catch {
      // Error state is captured via onError above; rethrow swallowed
      // so callers don't need a try/catch around submit.
    }
  };

  return {
    submit,
    isPending: mutation.isPending,
    formError,
  };
}

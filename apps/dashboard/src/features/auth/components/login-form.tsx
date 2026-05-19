import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useLogin } from "../hooks/use-login";
import { loginSchema, type LoginInput } from "../schemas/login-schema";

import { PasswordInput } from "./password-input";

export function LoginForm() {
  const { submit, isPending, formError } = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mb-6 space-y-3 text-center">
        <img src="/sidoc-logo.svg" alt="Sidoc" className="mx-auto h-10 w-auto" />
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
          <p className="text-sm text-muted-foreground">Accede a tu CRM de Sidoc</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {formError && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="tu@empresa.com"
            variant={errors.email ? "error" : "default"}
            aria-invalid={errors.email ? "true" : undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" className="text-xs text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Contraseña
          </label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            hasError={Boolean(errors.password)}
            aria-invalid={errors.password ? "true" : undefined}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <p id="password-error" className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Iniciando sesión…
            </>
          ) : (
            "Iniciar sesión"
          )}
        </Button>
      </form>
    </div>
  );
}

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useCreateClient } from "../hooks/use-create-client";
import {
  clientCreateSchema,
  type Client,
  type ClientCreateInput,
} from "../schemas/client-schema";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Reserved for edit mode — activated in HU-FE-005 commit 3.
  // Keeping the prop in the public contract from commit 1 avoids signature
  // churn between commits; the implementation that consumes it lands later.
  client?: Client;
}

const EMPTY_FORM: ClientCreateInput = {
  name: "",
  email: "",
  company: "",
  phone: "",
};

export function ClientFormDialog({
  open,
  onOpenChange,
  client: _client,
}: ClientFormDialogProps) {
  const createClient = useCreateClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    mode: "onChange",
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!open) {
      reset(EMPTY_FORM);
    }
  }, [open, reset]);

  const onSubmit = (data: ClientCreateInput) => {
    createClient.mutate(data, {
      onSuccess: () => {
        reset(EMPTY_FORM);
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo cliente</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-3 mt-2"
          noValidate
        >
          <div className="space-y-1.5">
            <label htmlFor="client-name" className="text-sm font-medium">
              Nombre *
            </label>
            <Input
              id="client-name"
              autoFocus
              placeholder="Nombre completo"
              variant={errors.name ? "error" : "default"}
              aria-invalid={errors.name ? "true" : undefined}
              aria-describedby={errors.name ? "client-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="client-name-error" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="client-email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="client-email"
              type="email"
              placeholder="cliente@empresa.com"
              variant={errors.email ? "error" : "default"}
              aria-invalid={errors.email ? "true" : undefined}
              aria-describedby={errors.email ? "client-email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="client-email-error" className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="client-company" className="text-sm font-medium">
              Empresa
            </label>
            <Input
              id="client-company"
              placeholder="Nombre de la empresa"
              variant={errors.company ? "error" : "default"}
              aria-invalid={errors.company ? "true" : undefined}
              aria-describedby={
                errors.company ? "client-company-error" : undefined
              }
              {...register("company")}
            />
            {errors.company && (
              <p id="client-company-error" className="text-xs text-destructive">
                {errors.company.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="client-phone" className="text-sm font-medium">
              Teléfono
            </label>
            <Input
              id="client-phone"
              placeholder="+57 300 000 0000"
              variant={errors.phone ? "error" : "default"}
              aria-invalid={errors.phone ? "true" : undefined}
              aria-describedby={errors.phone ? "client-phone-error" : undefined}
              {...register("phone")}
            />
            {errors.phone && (
              <p id="client-phone-error" className="text-xs text-destructive">
                {errors.phone.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={!isValid || createClient.isPending}
            >
              {createClient.isPending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

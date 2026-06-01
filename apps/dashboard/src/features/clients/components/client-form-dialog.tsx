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
import { useUpdateClient } from "../hooks/use-update-client";
import {
  clientCreateSchema,
  type Client,
  type ClientCreateInput,
} from "../schemas/client-schema";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // When defined → edit mode; when undefined → create mode.
  client?: Client;
}

const EMPTY_FORM: ClientCreateInput = {
  name: "",
  email: "",
  company: "",
  phone: "",
};

function clientToFormValues(client: Client): ClientCreateInput {
  return {
    name: client.name,
    email: client.email ?? "",
    company: client.company ?? "",
    phone: client.phone ?? "",
  };
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: ClientFormDialogProps) {
  const isEdit = !!client;
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  // Use clientCreateSchema (not clientUpdateSchema) in both modes:
  // - The form always returns all 4 fields (RHF defaultValues are strings, not undefined)
  // - In edit mode, allowing empty name (via partial) would let users save nameless clients
  // - clientUpdateSchema is still used for backend contract typing (PATCH semantically partial)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<ClientCreateInput>({
    resolver: zodResolver(clientCreateSchema),
    mode: "onChange",
    defaultValues: client ? clientToFormValues(client) : EMPTY_FORM,
  });

  useEffect(() => {
    if (open) {
      reset(client ? clientToFormValues(client) : EMPTY_FORM);
    } else {
      reset(EMPTY_FORM);
    }
  }, [open, client, reset]);

  const onSubmit = (data: ClientCreateInput) => {
    if (client) {
      updateMutation.mutate(
        { id: client.id, payload: data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const submitLabel = isEdit
    ? isPending
      ? "Guardando…"
      : "Guardar cambios"
    : isPending
      ? "Creando…"
      : "Crear";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar cliente" : "Nuevo cliente"}
          </DialogTitle>
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
            <Button type="submit" disabled={!isValid || isPending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

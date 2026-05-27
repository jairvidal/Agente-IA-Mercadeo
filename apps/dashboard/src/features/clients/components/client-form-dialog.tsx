import { type FormEvent, useState } from "react";

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
import type { Client } from "../schemas/client-schema";

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Reserved for edit mode — activated in HU-FE-005 commit 3.
  // Keeping the prop in the public contract from commit 1 avoids signature
  // churn between commits; the implementation that consumes it lands later.
  client?: Client;
}

const EMPTY_FORM = {
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
  const [form, setForm] = useState(EMPTY_FORM);
  const createClient = useCreateClient();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    createClient.mutate(form, {
      onSuccess: () => {
        setForm(EMPTY_FORM);
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
        <form onSubmit={handleSubmit} className="space-y-3 mt-2">
          <Input
            placeholder="Nombre *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            placeholder="Empresa"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
          <Input
            placeholder="Teléfono"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <DialogFooter>
            <Button type="submit" disabled={createClient.isPending}>
              {createClient.isPending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

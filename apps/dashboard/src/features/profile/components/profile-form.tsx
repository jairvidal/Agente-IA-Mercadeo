import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import { useUpdateProfile } from "../hooks/use-profile";
import type { Profile } from "../schemas/profile-schema";

interface ProfileFormProps {
  profile: Profile;
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const { toast } = useToast();
  const [name, setName] = useState(profile.name ?? "");
  const updateMutation = useUpdateProfile();

  useEffect(() => {
    setName(profile.name ?? "");
  }, [profile]);

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { name },
      {
        onSuccess: () => toast({ title: "Perfil guardado", variant: "success" }),
        onError: () => toast({ title: "Error al guardar perfil", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Email</label>
          <Input
            value={profile.email}
            readOnly
            className="read-only:bg-muted read-only:cursor-default read-only:text-muted-foreground"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Nombre</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Miembro desde</label>
          <p className="text-sm text-muted-foreground">
            {new Date(profile.createdAt).toLocaleDateString("es-CO")}
          </p>
        </div>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </div>
  );
}

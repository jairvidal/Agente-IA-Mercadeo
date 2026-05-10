import { type FormEvent, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { apiClient } from "@/lib/api";

interface Profile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export const Route = createFileRoute("/_dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => apiClient.get<Profile>("/profile"),
  });

  useEffect(() => {
    if (profile) setName(profile.name ?? "");
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string }) => apiClient.patch<Profile>("/profile", payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile"], updated);
      toast({ title: "Perfil guardado", variant: "success" });
    },
    onError: () => toast({ title: "Error al guardar perfil", variant: "destructive" }),
  });

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ name });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <PageHeader icon={<UserCircle />} title="Perfil" description="Gestiona tu cuenta" />

      {profile && (
        <div className="bg-card rounded-xl border border-border p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input value={profile.email} disabled />
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
                {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

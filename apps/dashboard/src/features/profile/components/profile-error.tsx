import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ProfileErrorProps {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}

export function ProfileError({ message, onRetry, retrying }: ProfileErrorProps) {
  return (
    <div className="bg-card rounded-xl border border-destructive/30 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-3 flex-1">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No pudimos cargar tu perfil</p>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
            <RefreshCw className={retrying ? "animate-spin" : ""} aria-hidden="true" />
            {retrying ? "Reintentando…" : "Intentar de nuevo"}
          </Button>
        </div>
      </div>
    </div>
  );
}

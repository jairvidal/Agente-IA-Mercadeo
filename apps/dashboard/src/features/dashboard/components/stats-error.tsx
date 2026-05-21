import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface StatsErrorProps {
  message: string;
  onRetry: () => void;
  retrying: boolean;
}

export function StatsError({ message, onRetry, retrying }: StatsErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 py-12 px-6 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-foreground">No pudimos cargar las estadísticas</p>
        <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
      </div>
      <Button onClick={onRetry} disabled={retrying} variant="outline" size="sm">
        <RefreshCw className={retrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {retrying ? "Reintentando…" : "Reintentar"}
      </Button>
    </div>
  );
}

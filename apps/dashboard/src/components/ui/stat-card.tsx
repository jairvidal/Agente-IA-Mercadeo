import * as React from "react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  progress?: number;
  labelClassName?: string;
  valueClassName?: string;
  action?: React.ReactNode;
  className?: string;
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  progress,
  labelClassName,
  valueClassName,
  action,
  className,
}: StatCardProps) {
  return (
    <div className={cn("bg-card rounded-xl border border-border p-5 shadow-soft", className)}>
      <div className="flex items-center justify-between mb-3">
        <div
          className={cn(
            "flex items-center gap-2 text-muted-foreground text-xs font-medium [&_svg]:h-4 [&_svg]:w-4",
            labelClassName,
          )}
        >
          {icon}
          {label}
        </div>
        {action}
      </div>
      <p className={cn("font-semibold text-foreground text-3xl tracking-tight", valueClassName)}>
        {value}
      </p>
      {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export { StatCard };
export type { StatCardProps };

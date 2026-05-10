import * as React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function PageHeader({ icon, title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground leading-tight truncate">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps };

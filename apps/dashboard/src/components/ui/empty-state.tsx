import * as React from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 px-6 text-center text-gray-500",
        className,
      )}
    >
      <div className="h-12 w-12 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 mb-2 [&_svg]:h-6 [&_svg]:w-6 [&_svg]:text-gray-400">
        {icon}
      </div>
      <p className="font-medium text-gray-900">{title}</p>
      {description && <p className="text-sm max-w-sm mx-auto">{description}</p>}
      {action}
    </div>
  );
}

export { EmptyState };
export type { EmptyStateProps };

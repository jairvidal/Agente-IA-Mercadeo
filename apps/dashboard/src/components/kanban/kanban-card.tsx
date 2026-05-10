import { Draggable } from "@hello-pangea/dnd";

import { Badge } from "@/components/ui/badge";
import type { BadgeVariants } from "@/components/ui/badge.variants";

interface KanbanCardProps {
  id: string;
  index: number;
  name: string;
  company?: string | null;
  source?: string | null;
}

const sourceVariant: Record<string, BadgeVariants["variant"]> = {
  Website: "blue",
  Referral: "success",
  LinkedIn: "violet",
  "Cold Call": "warning",
};

export function KanbanCard({ id, index, name, company, source }: KanbanCardProps) {
  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg border border-gray-200 p-3 shadow-sm select-none transition-shadow ${
            snapshot.isDragging ? "shadow-lg ring-2 ring-primary/20" : ""
          }`}
        >
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          {company && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{company}</p>
          )}
          {source && (
            <div className="mt-2">
              <Badge variant={sourceVariant[source] ?? "default"}>{source}</Badge>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

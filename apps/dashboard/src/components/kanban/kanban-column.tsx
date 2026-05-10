import { Droppable } from "@hello-pangea/dnd";

import { KanbanCard } from "./kanban-card";
import type { KanbanItem } from "./kanban-board";

interface KanbanColumnProps {
  id: string;
  label: string;
  items: KanbanItem[];
  color: string;
}

export function KanbanColumn({ id, label, items, color }: KanbanColumnProps) {
  return (
    <div className="flex flex-col w-64 shrink-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {items.length}
        </span>
      </div>

      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 rounded-xl min-h-[200px] p-2 transition-colors ${
              snapshot.isDraggingOver ? "bg-primary/5" : "bg-gray-50"
            }`}
          >
            {items.map((item, index) => (
              <KanbanCard
                key={item.id}
                id={item.id}
                index={index}
                name={item.name}
                company={item.company}
                source={item.source}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

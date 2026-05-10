import { useEffect, useState } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";

import { KanbanColumn } from "./kanban-column";

export interface KanbanColumnDef {
  id: string;
  label: string;
  color: string;
}

export interface KanbanItem {
  id: string;
  name: string;
  company?: string | null;
  source?: string | null;
  status: string;
}

interface KanbanBoardProps {
  columns: KanbanColumnDef[];
  items: KanbanItem[];
  onStatusChange: (itemId: string, newStatus: string) => Promise<void>;
}

export function KanbanBoard({ columns, items, onStatusChange }: KanbanBoardProps) {
  const [localItems, setLocalItems] = useState<KanbanItem[]>(items);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const onDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const newStatus = destination.droppableId;
    const item = localItems.find((i) => i.id === draggableId);
    if (!item || item.status === newStatus) return;

    setLocalItems((prev) =>
      prev.map((i) => (i.id === draggableId ? { ...i, status: newStatus } : i)),
    );

    await onStatusChange(draggableId, newStatus).catch(() => {
      setLocalItems((prev) =>
        prev.map((i) => (i.id === draggableId ? { ...i, status: item.status } : i)),
      );
    });
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            label={col.label}
            color={col.color}
            items={localItems.filter((i) => i.status === col.id)}
          />
        ))}
      </div>
    </DragDropContext>
  );
}

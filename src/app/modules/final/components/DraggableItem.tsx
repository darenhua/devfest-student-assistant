"use client";

import { useDraggable } from "@dnd-kit/core";
import type { DragItemData } from "./types";

export function DraggableItem({
  id,
  data,
  children,
}: {
  id: string;
  data: DragItemData;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      {children}
    </div>
  );
}

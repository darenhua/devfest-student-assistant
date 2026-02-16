/**
 * Generic drag-and-drop item data structure
 * This is a flexible interface that can be extended for different item types
 */
export interface DraggableItemData {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}

/**
 * Drag item data wrapper used by DndContext
 * Contains both the item type and the full item data
 */
export interface DragItemData {
  type: string;
  item: DraggableItemData;
}

// ─── Example item types for demo purposes ───

export interface HomeworkItem extends DraggableItemData {
  type: "homework";
  className?: string;
  dueDate: string;
  sourceUrl?: string;
  sourceName?: string;
}

export interface EventItem extends DraggableItemData {
  type: "event";
  timeLabel: string;
  location?: string;
  sourceUrl?: string;
}

export interface TaskItem extends DraggableItemData {
  type: "task";
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  completed?: boolean;
}

export interface NoteItem extends DraggableItemData {
  type: "note";
  tags?: string[];
  content?: string;
}

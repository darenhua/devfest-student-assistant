"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import type { BlockNoteEditor } from "@blocknote/core";
import { AIExtension } from "@blocknote/xl-ai";
import { EditorPanel } from "./EditorPanel";
import { ItemDashboard } from "./ItemDashboard";
import { DragPreviewCard } from "./DragPreviewCard";
import { buildAIPrompt } from "../utils/promptBuilder";
import type { DraggableItemData, DragItemData } from "./types";

export interface DragToEditorProps {
  // Item configuration
  items: DraggableItemData[];

  // Editor configuration
  initialMarkdown?: string;
  onMarkdownChange?: (markdown: string) => void;

  // AI configuration
  aiEndpoint?: string;
  buildPrompt?: (item: DragItemData) => string;

  // Customization
  renderItem?: (item: DraggableItemData) => React.ReactNode;
  renderPreview?: (data: DragItemData) => React.ReactNode;

  // Layout options
  editorClassName?: string;
  dashboardClassName?: string;
  dashboardTitle?: string;
  dropZoneId?: string;
  theme?: "light" | "dark";

  // Drag options
  activationDistance?: number;
}

/**
 * DragToEditor component
 * Main orchestrator for drag-and-drop AI-powered markdown editing
 *
 * Features:
 * - Two-panel layout: editor (left) and item dashboard (right)
 * - Drag items from dashboard to editor
 * - AI generates contextual content when items are dropped
 * - Customizable prompts, rendering, and styling
 * - Visual feedback during drag operations
 *
 * @example
 * ```tsx
 * <DragToEditor
 *   items={myItems}
 *   initialMarkdown="# My Document\n"
 *   onMarkdownChange={(md) => console.log(md)}
 *   buildPrompt={(item) => `Add: ${item.item.title}`}
 * />
 * ```
 */
export function DragToEditor({
  items,
  initialMarkdown = "# Daily Briefing\n\nDrag items from the right panel to add them here.\n",
  onMarkdownChange,
  aiEndpoint = "/ai/regular/streamText",
  buildPrompt = buildAIPrompt,
  renderItem,
  renderPreview,
  editorClassName,
  dashboardClassName,
  dashboardTitle = "Items",
  dropZoneId = "briefing-droppable",
  theme = "light",
  activationDistance = 8,
}: DragToEditorProps) {
  const dndId = useId();
  const [activeItem, setActiveItem] = useState<DragItemData | null>(null);
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const editorRef = useRef<BlockNoteEditor<any, any, any> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: activationDistance } })
  );

  const handleEditorReady = useCallback(
    (editor: BlockNoteEditor<any, any, any>) => {
      editorRef.current = editor;
    },
    []
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragItemData | undefined;
    if (data) setActiveItem(data);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over } = event;

      if (over?.id === dropZoneId && activeItem && editorRef.current) {
        const prompt = buildPrompt(activeItem);
        const ai = editorRef.current.getExtension(AIExtension);
        if (ai) {
          ai.invokeAI({ userPrompt: prompt, useSelection: false });
        }
      }

      setActiveItem(null);
    },
    [activeItem, buildPrompt, dropZoneId]
  );

  const handleMarkdownChange = useCallback(
    (md: string) => {
      setMarkdown(md);
      onMarkdownChange?.(md);
    },
    [onMarkdownChange]
  );

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen">
        {/* Left panel: Editor */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-white">
          <EditorPanel
            markdown={markdown}
            onEditorReady={handleEditorReady}
            onChange={handleMarkdownChange}
            aiEndpoint={aiEndpoint}
            dropZoneId={dropZoneId}
            className={editorClassName}
            theme={theme}
          />
        </div>

        {/* Divider */}
        <div className="w-px shrink-0 bg-muted-foreground/30" />

        {/* Right panel: Item Dashboard */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <ItemDashboard
            items={items}
            renderItem={renderItem}
            className={dashboardClassName}
            title={dashboardTitle}
          />
        </div>
      </div>

      {/* Drag overlay for preview */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <DragPreviewCard data={activeItem} renderPreview={renderPreview} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

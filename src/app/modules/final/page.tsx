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
import { DailyBriefing } from "./components/DailyBriefing";
import { AgentDashboard } from "./components/AgentDashboard";
import { DragPreviewCard } from "./components/DragPreviewCard";
import { buildAIPrompt } from "./components/buildAIPrompt";
import type { DragItemData } from "./components/types";

export default function FinalPage() {
  const dndId = useId();
  const [activeItem, setActiveItem] = useState<DragItemData | null>(null);
  const editorRef = useRef<BlockNoteEditor<any, any, any> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const handleEditorReady = useCallback(
    (editor: BlockNoteEditor<any, any, any>) => {
      editorRef.current = editor;
    },
    [],
  );

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as DragItemData | undefined;
    if (data) setActiveItem(data);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { over } = event;

    if (over?.id === "briefing-droppable" && activeItem && editorRef.current) {
      const prompt = buildAIPrompt(activeItem);
      const ai = editorRef.current.getExtension(AIExtension);
      if (ai) {
        ai.invokeAI({ userPrompt: prompt, useSelection: false });
      }
    }

    setActiveItem(null);
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen">
        {/* Left panel: Daily Markdown Briefing */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-white">
          <DailyBriefing onEditorReady={handleEditorReady} />
        </div>

        <div className="w-px shrink-0 bg-muted-foreground/30" />

        {/* Right panel: Agent Dashboard */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-gray-50/50">
          <AgentDashboard />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeItem ? <DragPreviewCard data={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

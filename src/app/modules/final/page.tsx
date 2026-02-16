"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Calendar, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { ChatSheet } from "./components/ChatSheet";
import { buildAIPrompt } from "./components/buildAIPrompt";
import type { DragItemData } from "./components/types";
import { CommentOverlayProvider } from "./comment-overlay/CommentOverlayProvider";
import { ExtractionTriggerButton } from "./components/ExtractionTriggerButton";

export default function FinalPage() {
  const dndId = useId();
  const [activeItem, setActiveItem] = useState<DragItemData | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
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
    <CommentOverlayProvider>
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

      {/* Floating dock */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
        }}
        className="flex gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 shadow-md"
      >
        <Button className="h-7 w-7 rounded-full" size="icon" variant="ghost">
          <Calendar className="h-3.5 w-3.5" />
        </Button>
        <Button
          className="h-7 w-7 rounded-full"
          size="icon"
          variant="ghost"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent noOverlay side="right" className="w-1/2 max-w-none!">
          <SheetHeader>
            <SheetTitle>Chat</SheetTitle>
          </SheetHeader>
          <ChatSheet />
        </SheetContent>
      </Sheet>

      {/* Extraction trigger button — floating pill above react-grab menu */}
      <ExtractionTriggerButton />
    </CommentOverlayProvider>
  );
}

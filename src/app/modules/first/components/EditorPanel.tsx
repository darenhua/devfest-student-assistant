"use client";

import dynamic from "next/dynamic";
import { useDroppable } from "@dnd-kit/core";
import type { BlockNoteEditor } from "@blocknote/core";

const BriefingEditor = dynamic(() => import("./BriefingEditor"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-gray-400">Loading editor...</p>,
});

interface EditorPanelProps {
  markdown: string;
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;
  onChange?: (markdown: string) => void;
  aiEndpoint?: string;
  dropZoneId?: string;
  className?: string;
  hoverClassName?: string;
  theme?: "light" | "dark";
}

/**
 * EditorPanel component
 * A droppable container for the markdown editor
 *
 * Features:
 * - Drop zone with visual feedback
 * - Background changes color when items are hovered over
 * - Wraps BriefingEditor with SSR disabled
 * - Configurable drop zone ID and styling
 */
export function EditorPanel({
  markdown,
  onEditorReady,
  onChange,
  aiEndpoint,
  dropZoneId = "briefing-droppable",
  className = "flex h-full flex-col bg-gray-50",
  hoverClassName = "bg-orange-200",
  theme = "light",
}: EditorPanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dropZoneId });

  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-colors duration-200 ${isOver ? hoverClassName : ""}`}
    >
      <div className="flex-1 overflow-y-auto">
        <BriefingEditor
          markdown={markdown}
          onEditorReady={onEditorReady}
          onChange={onChange}
          aiEndpoint={aiEndpoint}
          theme={theme}
        />
      </div>
    </div>
  );
}

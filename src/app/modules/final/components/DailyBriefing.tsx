"use client";

import dynamic from "next/dynamic";
import { useDroppable } from "@dnd-kit/core";
import { BRIEFING } from "./fixtures";
import type { BlockNoteEditor } from "@blocknote/core";
import { useState, useEffect, useCallback } from "react";

const BriefingEditor = dynamic(() => import("./BriefingEditor"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-gray-400">Loading editor...</p>,
});

export function DailyBriefing({
  onEditorReady,
}: {
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "briefing-droppable" });
  const [markdown, setMarkdown] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/briefing")
      .then((r) => r.json())
      .then((data) => setMarkdown(data.markdown || BRIEFING.markdown))
      .catch(() => setMarkdown(BRIEFING.markdown));
  }, []);

  const handleChange = useCallback((md: string) => {
    fetch("/api/briefing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markdown: md }),
    });
  }, []);

  if (markdown === null) {
    return <p className="p-6 text-sm text-gray-400">Loading briefing...</p>;
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full flex-col transition-colors duration-200 ${isOver ? "bg-orange-200" : "bg-gray-50"}`}
    >
      <div className="flex-1 overflow-y-auto">
        <BriefingEditor
          markdown={markdown}
          onEditorReady={onEditorReady}
          onChange={handleChange}
        />
      </div>
    </div>
  );
}

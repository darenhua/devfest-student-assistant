"use client";

import dynamic from "next/dynamic";
import { useDroppable } from "@dnd-kit/core";
import { BRIEFING } from "./fixtures";
import type { BlockNoteEditor } from "@blocknote/core";
import { useState, useEffect, useCallback } from "react";

const NotepadEditor = dynamic(() => import("./NotepadEditor"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-gray-400">Loading editor...</p>,
});

export interface NotepadProps {
  // Optional: custom droppable ID (defaults to "notepad-droppable")
  droppableId?: string;

  // Optional: custom API endpoints
  apiEndpoints?: {
    load: string; // GET endpoint, default: "/api/briefing"
    save: string; // PUT endpoint, default: "/api/briefing"
  };

  // Optional: custom AI transport endpoint
  aiEndpoint?: string; // default: "/ai/regular/streamText"

  // Optional: initial markdown (overrides API load)
  initialMarkdown?: string;

  // Optional: fallback markdown if API fails
  fallbackMarkdown?: string;

  // Optional: callback when editor instance is ready
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;

  // Optional: callback when markdown changes (debounced 500ms)
  onChange?: (markdown: string) => void;

  // Optional: custom debounce delay for auto-save (default: 500ms)
  saveDebounceMs?: number;

  // Optional: disable drag-and-drop integration
  disableDragDrop?: boolean;

  // Optional: custom styling
  className?: string;
  editorClassName?: string;

  // Optional: theme (default: "light")
  theme?: "light" | "dark";
}

export function Notepad({
  droppableId = "notepad-droppable",
  apiEndpoints,
  aiEndpoint,
  initialMarkdown,
  fallbackMarkdown,
  onEditorReady,
  onChange,
  saveDebounceMs,
  disableDragDrop = false,
  className,
  editorClassName,
  theme = "light",
}: NotepadProps) {
  const droppableConfig = disableDragDrop ? null : useDroppable({ id: droppableId });
  const [markdown, setMarkdown] = useState<string | null>(
    initialMarkdown !== undefined ? initialMarkdown : null
  );

  useEffect(() => {
    // If initialMarkdown is provided, use it and skip API call
    if (initialMarkdown !== undefined) {
      setMarkdown(initialMarkdown);
      return;
    }

    // If no API endpoints configured, use fallback or default
    if (!apiEndpoints?.load) {
      setMarkdown(fallbackMarkdown || BRIEFING.markdown);
      return;
    }

    // Load from API
    fetch(apiEndpoints.load)
      .then((r) => r.json())
      .then((data) => setMarkdown(data.markdown || fallbackMarkdown || BRIEFING.markdown))
      .catch(() => setMarkdown(fallbackMarkdown || BRIEFING.markdown));
  }, [initialMarkdown, apiEndpoints?.load, fallbackMarkdown]);

  const handleChange = useCallback(
    (md: string) => {
      // If custom onChange is provided, call it
      if (onChange) {
        onChange(md);
      }

      // If API endpoint is configured, save to it
      if (apiEndpoints?.save) {
        fetch(apiEndpoints.save, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: md }),
        });
      }
    },
    [onChange, apiEndpoints?.save]
  );

  if (markdown === null) {
    return <p className="p-6 text-sm text-gray-400">Loading briefing...</p>;
  }

  const containerClassName = `flex h-full flex-col transition-colors duration-200 ${
    !disableDragDrop && droppableConfig?.isOver ? "bg-orange-200" : "bg-gray-50"
  } ${className || ""}`;

  const content = (
    <div className={containerClassName}>
      <div className={`flex-1 overflow-y-auto ${editorClassName || ""}`}>
        <NotepadEditor
          markdown={markdown}
          onEditorReady={onEditorReady}
          onChange={handleChange}
          aiEndpoint={aiEndpoint}
          saveDebounceMs={saveDebounceMs}
          theme={theme}
        />
      </div>
    </div>
  );

  // If drag-drop is disabled, return content without droppable wrapper
  if (disableDragDrop || !droppableConfig) {
    return content;
  }

  // Wrap with droppable ref
  return <div ref={droppableConfig.setNodeRef}>{content}</div>;
}

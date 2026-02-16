"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";

import { BlockNoteEditor } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { AIExtension, AIMenuController } from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useCallback, useRef } from "react";

interface BriefingEditorProps {
  markdown: string;
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;
  onChange?: (markdown: string) => void;
  aiEndpoint?: string;
  theme?: "light" | "dark";
  className?: string;
}

/**
 * BriefingEditor component
 * A rich text editor powered by BlockNote with AI extension
 *
 * Features:
 * - Markdown parsing and serialization
 * - AI-powered content generation
 * - Auto-save with debouncing (500ms)
 * - Customizable AI endpoint
 * - Theme support
 */
export default function BriefingEditor({
  markdown,
  onEditorReady,
  onChange,
  aiEndpoint = "/ai/regular/streamText",
  theme = "light",
  className = "",
}: BriefingEditorProps) {
  const [content, setContent] = useState<any[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function parse() {
      const editor = BlockNoteEditor.create();
      const blocks = await editor.tryParseMarkdownToBlocks(markdown);
      if (!cancelled) setContent(blocks);
    }
    parse();
    return () => {
      cancelled = true;
    };
  }, [markdown]);

  if (!content) {
    return <p className="p-6 text-gray-400 text-sm">Loading editor...</p>;
  }

  return (
    <EditorInner
      initialContent={content}
      onEditorReady={onEditorReady}
      onChange={onChange}
      aiEndpoint={aiEndpoint}
      theme={theme}
      className={className}
    />
  );
}

interface EditorInnerProps {
  initialContent: any[];
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;
  onChange?: (markdown: string) => void;
  aiEndpoint: string;
  theme: "light" | "dark";
  className: string;
}

function EditorInner({
  initialContent,
  onEditorReady,
  onChange,
  aiEndpoint,
  theme,
  className,
}: EditorInnerProps) {
  const editor = useCreateBlockNote({
    dictionary: {
      ...en,
      ai: aiEn,
    },
    extensions: [
      AIExtension({
        transport: new DefaultChatTransport({
          api: aiEndpoint,
        }),
      }),
    ],
    initialContent,
  });

  useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback(() => {
    if (!onChangeRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const md = await editor.blocksToMarkdownLossy(editor.document);
      onChangeRef.current?.(md);
    }, 500);
  }, [editor]);

  return (
    <div className={className}>
      <BlockNoteView
        editor={editor}
        theme={theme}
        style={{ paddingTop: 24, paddingBottom: 300 }}
        onChange={handleChange}
      >
        <AIMenuController />
      </BlockNoteView>
    </div>
  );
}

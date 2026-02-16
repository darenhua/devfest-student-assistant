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

export default function BriefingEditor({
  markdown,
  onEditorReady,
  onChange,
}: {
  markdown: string;
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;
  onChange?: (markdown: string) => void;
}) {
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
    return <p className="p-6 text-gray-400 text-sm">Loading briefing...</p>;
  }

  return <EditorInner initialContent={content} onEditorReady={onEditorReady} onChange={onChange} />;
}

function EditorInner({
  initialContent,
  onEditorReady,
  onChange,
}: {
  initialContent: any[];
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;
  onChange?: (markdown: string) => void;
}) {
  const editor = useCreateBlockNote({
    dictionary: {
      ...en,
      ai: aiEn,
    },
    extensions: [
      AIExtension({
        transport: new DefaultChatTransport({
          api: "/ai/regular/streamText",
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
    <BlockNoteView
      editor={editor}
      theme="light"
      style={{ paddingTop: 24, paddingBottom: 300 }}
      onChange={handleChange}
    >
      <AIMenuController />
    </BlockNoteView>
  );
}

"use client";

import {
  BlockNoteEditor,
  BlockNoteEditor as BlockNoteEditorCore,
} from "@blocknote/core";
import type { Block } from "@blocknote/core";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import "@blocknote/core/fonts/inter.css";
import { en } from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import {
  FormattingToolbar,
  FormattingToolbarController,
  getDefaultReactSlashMenuItems,
  getFormattingToolbarItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from "@blocknote/react";
import {
  AIExtension,
  AIMenuController,
  AIToolbarButton,
  getAISlashMenuItems,
} from "@blocknote/xl-ai";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import "@blocknote/xl-ai/style.css";

import { DefaultChatTransport } from "ai";
import { useEffect, useState } from "react";

// --- Markdown briefings keyed by name ---
const BRIEFINGS: Record<string, string> = {
  "tuesday-feb-11": `
# Tuesday, Feb 11

## Due Today
- [ ] **CS 4111 — Databases**: HW3 (submit on Gradescope by 11:59pm)
- [ ] **COMS 4701 — AI**: Reading response Ch. 6

## Due Tomorrow
- [ ] **COMS 4115 — PLT**: Lexer milestone (push to GitHub)

## Office Hours Today
- **CS 4111**: Prof. Wu — 2:00–3:30pm, Mudd 535
- **COMS 4701**: TA Session — 4:00–5:30pm, Zoom (link in Ed)

## This Week
- [ ] **COMS 4115**: Parser design doc (due Friday)
- **COMS 4701 Midterm**: Thursday 7:00pm, Hamilton 702
  - Review session: Wednesday 6:00pm

## Notes
_Add your own notes here..._
`,
  "wednesday-feb-12": `
# Wednesday, Feb 12

## Due Today
- [ ] **COMS 4701 — AI**: Pre-lecture quiz (Canvas, 10:00am)

## Due Tomorrow
- [ ] **COMS 4115 — PLT**: Lexer milestone (push to GitHub)

## Happening Today
- **COMS 4701 Midterm Review**: 6:00pm, Hamilton 702
- **CS 4111**: No office hours today

## This Week
- [ ] **COMS 4115**: Parser design doc (due Friday)
- **COMS 4701 Midterm**: Tomorrow 7:00pm, Hamilton 702

## Notes
_Add your own notes here..._
`,
  "thursday-feb-13": `
# Thursday, Feb 13

## Due Today
- [ ] **COMS 4115 — PLT**: Lexer milestone (push to GitHub)

## Exams Today
- **COMS 4701 Midterm**: 7:00pm, Hamilton 702
  - Bring student ID + pencils
  - Covers chapters 1–6

## Due Friday
- [ ] **COMS 4115**: Parser design doc

## Office Hours Today
- **COMS 4115**: Prof. Aho — 1:00–2:30pm, CEPSR 620

## Notes
_Add your own notes here..._
`,
};

const BRIEFING_LABELS: Record<string, string> = {
  "tuesday-feb-11": "Tue Feb 11",
  "wednesday-feb-12": "Wed Feb 12",
  "thursday-feb-13": "Thu Feb 13",
};

// --- Inner editor (rendered only once initialContent is ready) ---
function EditorInner({ initialContent }: { initialContent: Block[] }) {
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
    initialContent: initialContent as any,
  });

  return (
    <BlockNoteView
      editor={editor}
      formattingToolbar={false}
      slashMenu={false}
      style={{ paddingBottom: "300px" }}
    >
      <AIMenuController />
      <FormattingToolbarWithAI />
      <SuggestionMenuWithAI editor={editor} />
    </BlockNoteView>
  );
}

// --- Main component ---
export default function App() {
  const [selected, setSelected] = useState("tuesday-feb-11");
  const [parsedContent, setParsedContent] = useState<Block[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setParsedContent(null);

    async function parse() {
      const tempEditor = BlockNoteEditorCore.create();
      const blocks = await tempEditor.tryParseMarkdownToBlocks(
        BRIEFINGS[selected],
      );
      if (!cancelled) {
        setParsedContent(blocks as Block[]);
      }
    }
    parse();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
      <div style={{ marginBottom: "16px" }}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            fontSize: "14px",
            background: "white",
            cursor: "pointer",
          }}
        >
          {Object.keys(BRIEFINGS).map((key) => (
            <option key={key} value={key}>
              {BRIEFING_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {parsedContent ? (
        <EditorInner key={selected} initialContent={parsedContent} />
      ) : (
        <div style={{ color: "#9ca3af" }}>Loading briefing...</div>
      )}
    </div>
  );
}

// Formatting toolbar with the `AIToolbarButton` added
function FormattingToolbarWithAI() {
  return (
    <FormattingToolbarController
      formattingToolbar={() => (
        <FormattingToolbar>
          {...getFormattingToolbarItems()}
          <AIToolbarButton />
        </FormattingToolbar>
      )}
    />
  );
}

// Slash menu with the AI option added
function SuggestionMenuWithAI(props: {
  editor: BlockNoteEditor<any, any, any>;
}) {
  return (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) =>
        filterSuggestionItems(
          [
            ...getDefaultReactSlashMenuItems(props.editor),
            ...getAISlashMenuItems(props.editor),
          ],
          query,
        )
      }
    />
  );
}

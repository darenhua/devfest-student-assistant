# Notepad Component Extraction Spec

## Overview

Extract the **DailyBriefing** notepad component from the final module. This is a rich-text markdown editor with AI capabilities that allows users to:
- Edit markdown content in a WYSIWYG editor
- Accept drag-and-drop items that trigger AI-powered content generation
- Auto-save changes to persistent storage
- Provide AI assistance via the BlockNote XL AI extension

## What to Extract

### Core Components

1. **DailyBriefing Container** (`DailyBriefing.tsx`)
   - Manages droppable area for drag-and-drop integration
   - Loads markdown content from an API endpoint
   - Handles auto-save on content changes
   - Shows visual feedback when items are dragged over (background color change)
   - Exposes editor instance via `onEditorReady` callback

2. **BriefingEditor** (`BriefingEditor.tsx`)
   - Wraps BlockNote editor with AI extension
   - Parses initial markdown into BlockNote blocks
   - Implements debounced auto-save (500ms delay)
   - Configures AI transport endpoint
   - Shows loading state while parsing markdown

### Visual Output

- **Full-height panel**: Takes up entire height of its container
- **Background transitions**: Changes from gray-50 to orange-200 when drag-over active
- **Padding**: Editor has top padding (24px) and large bottom padding (300px) for comfortable scrolling
- **Theme**: Light theme with Inter font
- **Loading states**: Shows "Loading editor..." and "Loading briefing..." text in gray

### Interactivity

1. **Droppable Area**
   - Uses `@dnd-kit/core` for drag-and-drop
   - ID: `"briefing-droppable"`
   - Accepts any draggable items (parent decides what to do on drop)

2. **AI Integration**
   - BlockNote AI extension with menu controller
   - Parent can invoke AI by getting editor reference and calling:
     ```typescript
     const ai = editor.getExtension(AIExtension);
     ai.invokeAI({ userPrompt: "...", useSelection: false });
     ```

3. **Auto-save**
   - Debounced at 500ms
   - Converts BlockNote document to markdown
   - Sends PUT request to storage endpoint

### State Management

- **Markdown loading**: Fetches from `/api/briefing` (GET)
- **Auto-save**: PUTs to `/api/briefing` with `{ markdown: string }`
- **Editor lifecycle**: Notifies parent when editor is ready via callback
- **Content parsing**: Converts markdown → BlockNote blocks on mount

### Side Effects

- Fetches markdown on component mount
- Auto-saves on every editor change (debounced)
- Dynamic imports BriefingEditor client-side only (SSR disabled)

## Dependencies to Carry

### NPM Packages

```json
{
  "@blocknote/core": "^0.x.x",
  "@blocknote/mantine": "^0.x.x",
  "@blocknote/react": "^0.x.x",
  "@blocknote/xl-ai": "^0.x.x",
  "@dnd-kit/core": "^6.x.x",
  "ai": "^3.x.x"
}
```

### CSS Imports (Required in BriefingEditor)

```typescript
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
```

### Utilities

- **buildAIPrompt** (`buildAIPrompt.ts`): Converts drag item data to AI prompts
  - Takes `DragItemData` (homework, event, office_hour, exam)
  - Returns formatted prompt string for AI

### Types

```typescript
// From types.ts
export interface Briefing {
  id: string;
  label: string;
  markdown: string;
}

export type DragItemData =
  | { type: "homework"; item: HomeworkItem }
  | { type: "event"; item: EventItem }
  | { type: "office_hour"; item: OfficeHourItem }
  | { type: "exam"; item: ExamItem };
```

### API Endpoints

1. **GET /api/briefing**
   - Returns: `{ markdown: string }`
   - Falls back to fixture data on error

2. **PUT /api/briefing**
   - Body: `{ markdown: string }`
   - Returns: `{ ok: true }`

3. **POST /ai/regular/streamText**
   - Used by BlockNote AI extension
   - Body: `{ messages, toolDefinitions }`
   - Streams AI responses using OpenAI gpt-4o

### Fixture Data

```typescript
// Default markdown content for fallback
export const BRIEFING: Briefing = {
  id: "tuesday-feb-11",
  label: "Tuesday, Feb 11",
  markdown: `# Things I have to do today:

- [ ] Statistics Problem Set 1 — **important**, due tomorrow
- [ ] Go to Prof. Chen's office hours (CS 350, Wed 1-3pm) to ask about HW 2
- [ ] Start Essay Draft: Modern Poetry (ENG 101, due Feb 14)

# Things due this week:

- [ ] Operating Systems Homework 2 — due Feb 14
- [ ] Essay Draft: Modern Poetry — due Feb 14
- [ ] Chemistry Lab Report 3 — due Feb 15

# Today's schedule:

- 9:00 AM — MATH 221 Lecture (Hall 201)
- 11:00 AM — CS 350 Lecture (CS Building 105)
- 2:00 PM — ENG 101 Workshop (Liberal Arts 302)
- 6:00 PM — Study Group - OS (Library Room 3B)

# Notes:

`,
};
```

## What to Leave Behind

### App-Specific Context

- **CommentOverlayProvider**: Specific to the final module's comment system
- **DndContext setup**: Parent component's responsibility (sensors, handlers)
- **DragOverlay**: Parent manages drag preview rendering
- **Parent-level drag handlers**: `handleDragStart`, `handleDragEnd` logic
- **ExtractionTriggerButton**: Meta-feature for extracting components
- **ChatSheet**: Separate chat interface feature
- **AgentDashboard**: Right-side panel is not part of notepad

### Module-Specific Integrations

- `/api/briefing` points to `src/app/modules/final/data/briefing.md` — new module needs its own storage location
- Specific drag item types (homework, events, etc.) — these are domain-specific to school assistant

## Integration Plan

### Props API

```typescript
interface DailyBriefingProps {
  // Optional: Called when editor is initialized and ready to use
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;

  // Optional: Override default API endpoints
  apiEndpoints?: {
    load?: string;  // Default: '/api/briefing'
    save?: string;  // Default: '/api/briefing'
  };

  // Optional: Provide initial markdown instead of loading from API
  initialMarkdown?: string;

  // Optional: Disable drag-and-drop droppable behavior
  droppable?: boolean; // Default: true

  // Optional: Custom droppable ID
  droppableId?: string; // Default: 'briefing-droppable'
}
```

### Context/Provider Requirements

1. **DndContext** (if using drag-and-drop)
   ```typescript
   import { DndContext, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';

   const sensors = useSensors(
     useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
   );

   <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
     <DailyBriefing onEditorReady={handleEditorReady} />
   </DndContext>
   ```

2. **Environment Variables**
   ```bash
   # Required for AI features
   OPENAI_API_KEY=sk-...
   ```

### Setup Requirements

1. **Install dependencies**
   ```bash
   bun add @blocknote/core @blocknote/mantine @blocknote/react @blocknote/xl-ai
   bun add @dnd-kit/core
   bun add ai @ai-sdk/openai
   ```

2. **Create API endpoints**
   - Implement GET and PUT handlers for `/api/briefing`
   - Implement POST handler for `/ai/regular/streamText`
   - Store markdown in file system or database

3. **Create data directory** (if using file storage)
   ```bash
   mkdir -p src/app/modules/ti/data
   touch src/app/modules/ti/data/briefing.md
   ```

4. **Copy CSS imports**: Ensure BlockNote stylesheets are imported

### Usage Example

#### Basic Usage (Standalone)

```typescript
"use client";

import { DailyBriefing } from '@/modules/ti/components/DailyBriefing';

export default function NotePage() {
  return (
    <div className="h-screen">
      <DailyBriefing />
    </div>
  );
}
```

#### Advanced Usage (With Drag-and-Drop)

```typescript
"use client";

import { useState, useRef } from 'react';
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import type { BlockNoteEditor } from '@blocknote/core';
import { AIExtension } from '@blocknote/xl-ai';
import { DailyBriefing } from '@/modules/ti/components/DailyBriefing';
import { buildAIPrompt } from '@/modules/ti/utils/buildAIPrompt';

export default function IntegratedPage() {
  const editorRef = useRef<BlockNoteEditor | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleEditorReady(editor: BlockNoteEditor) {
    editorRef.current = editor;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { over, active } = event;

    if (over?.id === 'briefing-droppable' && editorRef.current) {
      const dragData = active.data.current;
      const prompt = buildAIPrompt(dragData);

      const ai = editorRef.current.getExtension(AIExtension);
      if (ai) {
        ai.invokeAI({ userPrompt: prompt, useSelection: false });
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="h-screen">
        <DailyBriefing onEditorReady={handleEditorReady} />
      </div>
    </DndContext>
  );
}
```

### File Structure in New Module

```
src/app/modules/ti/
├── SPEC.md                          # This file
├── components/
│   ├── DailyBriefing.tsx           # Main container component
│   ├── BriefingEditor.tsx          # BlockNote editor wrapper
│   └── types.ts                     # TypeScript interfaces
├── utils/
│   └── buildAIPrompt.ts            # AI prompt builder (if using DnD)
├── data/
│   └── briefing.md                 # Persistent markdown storage
└── fixtures.ts                      # Default content fallback
```

### API Implementation Template

```typescript
// src/app/api/briefing/route.ts
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const BRIEFING_PATH = join(
  process.cwd(),
  "src/app/modules/ti/data/briefing.md"
);

export async function GET() {
  try {
    const content = await readFile(BRIEFING_PATH, "utf-8");
    return Response.json({ markdown: content });
  } catch {
    // Return empty or default content
    return Response.json({ markdown: "# My Notes\n\n" }, { status: 200 });
  }
}

export async function PUT(req: Request) {
  try {
    const { markdown } = await req.json();
    if (typeof markdown !== "string") {
      return Response.json(
        { error: "markdown must be a string" },
        { status: 400 }
      );
    }
    await writeFile(BRIEFING_PATH, markdown, "utf-8");
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
```

```typescript
// src/app/ai/regular/streamText/route.ts
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, toolDefinitions } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system: aiDocumentFormats.html.systemPrompt,
    messages: await convertToModelMessages(
      injectDocumentStateMessages(messages),
    ),
    tools: toolDefinitionsToToolSet(toolDefinitions),
    toolChoice: "required",
  });

  return result.toUIMessageStreamResponse();
}
```

## Testing the Extracted Component

1. **Verify editor loads**: Check that markdown content loads and displays
2. **Test auto-save**: Make changes and verify they persist after page reload
3. **Test AI features**: Use BlockNote's built-in AI menu (slash commands)
4. **Test drag-and-drop** (if applicable): Drag items onto editor and verify AI prompt generation
5. **Test loading states**: Check both initial load and markdown parsing phases
6. **Test error handling**: Verify fallback to fixture data when API fails

## Known Limitations

- **SSR**: BriefingEditor must be dynamically imported with `ssr: false`
- **AI Costs**: Each AI invocation uses OpenAI API (requires billing)
- **Debounce**: Changes are saved after 500ms of inactivity (not immediate)
- **File Storage**: Default implementation uses local file system (not suitable for serverless)
- **Single Document**: Only supports one briefing document at a time
- **No Versioning**: Overwrites previous content without history

## Future Enhancement Opportunities

- Add support for multiple documents/pages
- Implement undo/redo history
- Add real-time collaboration (CRDT or operational transforms)
- Support database storage instead of file system
- Add export functionality (PDF, HTML, Word)
- Implement document search/indexing
- Add custom slash commands beyond built-in AI features
- Support file attachments/images

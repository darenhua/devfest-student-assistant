# Notepad Component Extraction Specification

## Overview

This spec describes how to extract the **AI-powered markdown notepad** component from `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/page.tsx` (specifically the `DailyBriefing` component and its dependencies).

The notepad is a rich markdown editor built on BlockNote with AI capabilities, drag-and-drop integration, and persistent storage. It serves as a daily briefing/task management surface that can accept dragged items and use AI to intelligently insert them.

---

## What to Extract

### Core Functionality

The notepad component consists of three layers:

1. **DailyBriefing** (container component)
   - Manages markdown data loading and saving via API
   - Provides drag-and-drop target functionality (via `@dnd-kit/core`)
   - Shows loading states
   - Handles visual feedback when items are dragged over it
   - **Location**: `src/app/modules/final/components/DailyBriefing.tsx`

2. **BriefingEditor** (dynamic loader wrapper)
   - Dynamically imports the actual editor (client-side only, no SSR)
   - Handles markdown-to-blocks parsing
   - Manages loading state during initial parse
   - **Location**: `src/app/modules/final/components/BriefingEditor.tsx`

3. **EditorInner** (editor instance)
   - Creates and configures the BlockNote editor instance
   - Integrates AI extension with custom transport endpoint
   - Implements debounced auto-save (500ms delay)
   - Exposes editor instance to parent via callback
   - Renders the BlockNoteView with AI menu controller
   - **Location**: `src/app/modules/final/components/BriefingEditor.tsx` (inner component)

### Key Features to Preserve

1. **Markdown Persistence**
   - Loads markdown from `/api/briefing` (GET)
   - Auto-saves changes to `/api/briefing` (PUT) with 500ms debounce
   - Falls back to fixture data if API fails
   - Converts between markdown ↔ BlockNote's block structure

2. **AI Integration**
   - Uses `@blocknote/xl-ai` AIExtension
   - Custom AI transport pointing to `/ai/regular/streamText`
   - AI can be programmatically invoked via `editor.getExtension(AIExtension).invokeAI({ userPrompt, useSelection })`
   - Includes AIMenuController in the UI for user-initiated AI actions

3. **Drag-and-Drop Target**
   - Registers as a droppable zone with id `"briefing-droppable"`
   - Changes background color when dragged items hover over it (orange-200 highlight)
   - Parent can access the editor instance to programmatically insert content when items are dropped

4. **Editor Configuration**
   - Light theme
   - Custom padding (top: 24px, bottom: 300px for breathing room)
   - English dictionary with AI locale
   - Exports markdown via `blocksToMarkdownLossy`

---

## Dependencies to Carry

### NPM Packages

```json
{
  "@blocknote/core": "^0.x.x",
  "@blocknote/react": "^0.x.x",
  "@blocknote/mantine": "^0.x.x",
  "@blocknote/xl-ai": "^0.x.x",
  "@dnd-kit/core": "^6.x.x",
  "ai": "^3.x.x",
  "react": "^19.x.x",
  "next": "^16.x.x"
}
```

### CSS Imports (Required)

These must be imported at the top of `BriefingEditor.tsx`:

```tsx
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
```

### Type Imports

From `@blocknote/core`:
- `BlockNoteEditor`
- `en` (English dictionary)

From `@blocknote/react`:
- `useCreateBlockNote`

From `@blocknote/mantine`:
- `BlockNoteView`

From `@blocknote/xl-ai`:
- `AIExtension`
- `AIMenuController`
- `en` as `aiEn` (AI-specific English locale)

From `@dnd-kit/core`:
- `useDroppable`

From `ai`:
- `DefaultChatTransport`

From React:
- `useState`, `useEffect`, `useCallback`, `useRef`

From Next.js:
- `dynamic` (for dynamic import)

### Fixture Data

Copy the `BRIEFING` export from `fixtures.ts`:

```typescript
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

And the `Briefing` type:

```typescript
export interface Briefing {
  id: string;
  label: string;
  markdown: string;
}
```

---

## What to Leave Behind

### Do NOT Extract

1. **Drag-and-Drop Context Provider** (`DndContext`)
   - This is managed by the parent page, not the component
   - The notepad only registers as a droppable zone, it doesn't provide the context

2. **Drag Handling Logic**
   - The `buildAIPrompt` function is application-specific business logic
   - The parent's `handleDragEnd` that invokes AI on drop
   - The `DragItemData` types specific to the school assistant app

3. **CommentOverlayProvider**
   - This is a separate feature unrelated to the notepad itself

4. **Sheet/Chat Components**
   - ChatSheet, Sheet components from the parent page

5. **Other Dashboard Components**
   - AgentDashboard, DragPreviewCard, ExtractionTriggerButton
   - These are siblings, not dependencies

### Application-Specific Coupling to Remove

The current implementation is tightly coupled to:
- The specific `/api/briefing` endpoint structure
- The drag-and-drop data model (`DragItemData` types)
- The AI prompt building logic for school items

These should be made **configurable** in the extracted version.

---

## Integration Plan

### Props API for Extracted Component

```typescript
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
```

### Usage Example

#### Standalone Notepad (No Drag-Drop)

```tsx
import { Notepad } from "@/modules/notepad";

export default function MyPage() {
  return (
    <div className="h-screen">
      <Notepad
        initialMarkdown="# My Notes\n\nStart writing..."
        onChange={(md) => console.log("Content changed:", md)}
      />
    </div>
  );
}
```

#### With Drag-and-Drop Integration

```tsx
import { Notepad } from "@/modules/notepad";
import { DndContext, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { useState, useRef, useCallback } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { AIExtension } from "@blocknote/xl-ai";

export default function MyPage() {
  const editorRef = useRef<BlockNoteEditor<any, any, any> | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleEditorReady = useCallback((editor: BlockNoteEditor<any, any, any>) => {
    editorRef.current = editor;
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { over } = event;

    if (over?.id === "my-notepad" && editorRef.current) {
      // Build your custom prompt based on dragged data
      const prompt = "Insert: " + JSON.stringify(event.active.data.current);

      const ai = editorRef.current.getExtension(AIExtension);
      if (ai) {
        ai.invokeAI({ userPrompt: prompt, useSelection: false });
      }
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="h-screen">
        <Notepad
          droppableId="my-notepad"
          onEditorReady={handleEditorReady}
        />
      </div>
    </DndContext>
  );
}
```

#### With Custom API Endpoints

```tsx
<Notepad
  apiEndpoints={{
    load: "/api/my-notes",
    save: "/api/my-notes",
  }}
  fallbackMarkdown="# Default Content\n\nNo data available."
/>
```

---

## File Structure for Extracted Module

```
src/app/modules/notepad/
├── page.tsx                    # Demo/example page
├── components/
│   ├── Notepad.tsx            # Main exported component (DailyBriefing renamed)
│   ├── NotepadEditor.tsx      # BriefingEditor renamed
│   ├── types.ts               # Briefing type
│   └── fixtures.ts            # Default BRIEFING data
└── README.md                  # Usage documentation
```

---

## Implementation Checklist

When implementing the extracted component:

- [ ] Copy `DailyBriefing.tsx` → `Notepad.tsx`
- [ ] Copy `BriefingEditor.tsx` → `NotepadEditor.tsx`
- [ ] Copy relevant types from `types.ts` (only `Briefing` interface)
- [ ] Copy `BRIEFING` from `fixtures.ts`
- [ ] Rename all references: `DailyBriefing` → `Notepad`, `BriefingEditor` → `NotepadEditor`
- [ ] Replace hardcoded values with props:
  - Droppable ID: `"briefing-droppable"` → `props.droppableId ?? "notepad-droppable"`
  - API endpoints: `/api/briefing` → `props.apiEndpoints?.load ?? "/api/briefing"`
  - AI endpoint: `/ai/regular/streamText` → `props.aiEndpoint ?? "/ai/regular/streamText"`
  - Debounce delay: `500` → `props.saveDebounceMs ?? 500`
- [ ] Make drag-drop optional: wrap `useDroppable` logic in conditional based on `props.disableDragDrop`
- [ ] Make API calls optional: if `props.initialMarkdown` is provided, use it instead of fetching
- [ ] Make auto-save optional: only call API if `props.apiEndpoints` is provided, otherwise just call `props.onChange`
- [ ] Add theme prop support: `theme={props.theme ?? "light"}`
- [ ] Add className props for styling customization
- [ ] Export `Notepad` as default from module
- [ ] Create demo page showing basic usage
- [ ] Write README with integration examples

---

## Backend Requirements

The extracted component expects these API endpoints to exist:

### `GET /api/briefing` (or custom endpoint)

**Response:**
```json
{
  "markdown": "# My Notes\n\nContent here..."
}
```

### `PUT /api/briefing` (or custom endpoint)

**Request Body:**
```json
{
  "markdown": "# Updated Notes\n\nNew content..."
}
```

**Response:** Any success response (200 OK)

### `POST /ai/regular/streamText` (or custom endpoint)

This is the AI chat endpoint used by `DefaultChatTransport` from the `ai` package.

**Request:** Standard Vercel AI SDK format
**Response:** Streaming text response

If you don't have this endpoint, you need to implement it using Vercel AI SDK:

```typescript
// app/ai/regular/streamText/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai'; // or your provider

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

---

## Testing Checklist

After extraction:

- [ ] Notepad renders with default markdown
- [ ] Notepad loads markdown from API on mount
- [ ] Auto-save works (check network tab for PUT after 500ms)
- [ ] AI menu appears and works (user-initiated AI)
- [ ] Drag-and-drop highlight works (if enabled)
- [ ] Programmatic AI invocation works (if using `onEditorReady`)
- [ ] Fallback markdown works when API fails
- [ ] Custom props override defaults correctly
- [ ] Works without API endpoints (controlled mode with `onChange`)
- [ ] Dynamic import doesn't cause hydration errors
- [ ] CSS imports load correctly (Inter font, Mantine styles, AI styles)

---

## Notes

1. **Client-Side Only**: The editor MUST be dynamically imported with `ssr: false` because BlockNote doesn't support SSR.

2. **AI Extension**: The AI features require a working streaming endpoint. If you don't have one, the editor will still work but AI features won't function.

3. **Markdown Parsing**: BlockNote uses its own block structure internally. The component handles conversion automatically via `tryParseMarkdownToBlocks` and `blocksToMarkdownLossy`.

4. **Auto-Save Debouncing**: Changes are debounced at 500ms to avoid excessive API calls. This is configurable via props.

5. **Editor Instance Access**: If you need to programmatically control the editor (e.g., for drag-drop integration), use the `onEditorReady` callback to capture the editor instance.

6. **Memory Considerations**: Each editor instance maintains its own state. If you need multiple notepads on one page, ensure they have unique `droppableId` values.

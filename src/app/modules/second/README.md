# AI-Powered Notepad Component

An AI-powered markdown notepad component built on BlockNote with drag-and-drop integration, persistent storage, and customizable configuration.

## Features

- **Rich Markdown Editor**: Built on BlockNote with full markdown support
- **AI Integration**: AI-powered content generation and editing via `@blocknote/xl-ai`
- **Auto-Save**: Debounced auto-save to API endpoints (default: 500ms)
- **Drag-and-Drop**: Optional drag-and-drop target integration with `@dnd-kit/core`
- **Persistent Storage**: Loads and saves markdown via configurable API endpoints
- **Fully Configurable**: Extensive props API for customization
- **TypeScript**: Full TypeScript support with type definitions

## Installation

The component requires the following dependencies:

```bash
npm install @blocknote/core @blocknote/react @blocknote/mantine @blocknote/xl-ai @dnd-kit/core ai
```

## Basic Usage

### Standalone Notepad

```tsx
import { Notepad } from "@/app/modules/second/components/Notepad";

export default function MyPage() {
  return (
    <div className="h-screen">
      <Notepad
        initialMarkdown="# My Notes\n\nStart writing..."
        onChange={(md) => console.log("Content changed:", md)}
        disableDragDrop={true}
      />
    </div>
  );
}
```

### With API Persistence

```tsx
import { Notepad } from "@/app/modules/second/components/Notepad";

export default function MyPage() {
  return (
    <div className="h-screen">
      <Notepad
        apiEndpoints={{
          load: "/api/my-notes",
          save: "/api/my-notes",
        }}
        fallbackMarkdown="# Default Content\n\nNo data available."
      />
    </div>
  );
}
```

### With Drag-and-Drop Integration

```tsx
"use client";

import { Notepad } from "@/app/modules/second/components/Notepad";
import { DndContext, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { useState, useRef, useCallback } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { AIExtension } from "@blocknote/xl-ai";
import type { DragEndEvent } from "@dnd-kit/core";

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

## Props API

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

## API Endpoints

### Load Endpoint (GET)

**Expected Response:**
```json
{
  "markdown": "# My Notes\n\nContent here..."
}
```

### Save Endpoint (PUT)

**Expected Request Body:**
```json
{
  "markdown": "# Updated Notes\n\nNew content..."
}
```

**Expected Response:** Any success response (200 OK)

### AI Endpoint (POST)

The AI endpoint should follow the Vercel AI SDK format. Example implementation:

```typescript
// app/ai/regular/streamText/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

## Component Architecture

The notepad consists of three layers:

1. **Notepad** (container component)
   - Manages markdown data loading and saving via API
   - Provides drag-and-drop target functionality
   - Shows loading states
   - Handles visual feedback when items are dragged over it

2. **NotepadEditor** (dynamic loader wrapper)
   - Dynamically imports the actual editor (client-side only, no SSR)
   - Handles markdown-to-blocks parsing
   - Manages loading state during initial parse

3. **EditorInner** (editor instance)
   - Creates and configures the BlockNote editor instance
   - Integrates AI extension with custom transport endpoint
   - Implements debounced auto-save
   - Exposes editor instance to parent via callback
   - Renders the BlockNoteView with AI menu controller

## Important Notes

1. **Client-Side Only**: The editor is dynamically imported with `ssr: false` because BlockNote doesn't support SSR.

2. **AI Features**: AI features require a working streaming endpoint. If you don't have one, the editor will still work but AI features won't function.

3. **Markdown Conversion**: BlockNote uses its own block structure internally. The component handles conversion automatically via `tryParseMarkdownToBlocks` and `blocksToMarkdownLossy`.

4. **Auto-Save Debouncing**: Changes are debounced (default 500ms) to avoid excessive API calls.

5. **Editor Instance Access**: Use the `onEditorReady` callback to capture the editor instance for programmatic control.

6. **Drag-Drop Integration**: The component registers as a droppable zone but doesn't provide the DndContext. You must wrap it in a DndContext provider.

## Styling

The component includes default styling:
- Background changes to orange-200 when items are dragged over (if drag-drop enabled)
- Default background is gray-50
- Custom classes can be added via `className` and `editorClassName` props

## Examples

See the demo page at `/modules/second` for a working example.

## License

Part of the devfest-school project.

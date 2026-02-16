# Drag-and-Drop AI Fill Component Extraction Spec

## Overview

This spec covers the extraction of a **drag-and-drop to AI-powered notepad** system from `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/page.tsx`. The component orchestrates a split-panel interface where users can drag cards (homework, events, exams, office hours) from the right panel and drop them onto the left panel (a BlockNote markdown editor), triggering an AI extension to automatically insert formatted content based on the dragged item.

## What to Extract

### Core Behavior

The system consists of three main interactive parts:

1. **Drag Context Manager** (Main orchestrator)
   - Manages drag-and-drop state using `@dnd-kit/core`
   - Tracks which item is being dragged (`activeItem`)
   - Provides visual feedback during drag via `DragOverlay`
   - Detects when item is dropped onto the editor zone
   - Triggers AI insertion when drop occurs

2. **Droppable Editor Zone** (Left panel)
   - BlockNote-based markdown editor with AI extension
   - Acts as a drop target (`briefing-droppable`)
   - Visual feedback when drag is hovering (background color change)
   - Maintains editor reference for programmatic AI invocation

3. **Draggable Items Source** (Right panel)
   - Displays cards for various item types (homework, events, office hours, exams)
   - Each card is wrapped in a draggable container
   - Passes typed data payload with each drag operation

### Key User Flow

1. User initiates drag on any card in the right panel
2. System captures item data and shows drag preview overlay
3. User drags over the editor (left panel) - background changes to orange
4. User drops item onto editor
5. System builds AI prompt based on item type and properties
6. AI extension automatically inserts formatted content into editor at cursor/end
7. Drag state clears, UI returns to normal

### Visual Output

- **Split Panel Layout**: 50/50 flexible split with 1px divider
- **Drag Preview**: Floating card that follows cursor during drag (scaled 105%, shadow)
- **Drop Zone Feedback**: Editor background transitions to orange (`bg-orange-200`) when drag is hovering
- **Dragging State**: Original card becomes 30% opacity while being dragged

### State Management

- `activeItem`: Tracks currently dragged item (type + data payload)
- `editorRef`: Reference to BlockNote editor instance for AI invocation
- Drag sensors with 8px activation distance to prevent accidental drags

### Side Effects

- AI prompt construction based on item type (homework/event/office_hour/exam)
- Programmatic AI invocation via `AIExtension.invokeAI()`
- Editor content modification via AI streaming

## Dependencies to Carry

### External Packages

```json
{
  "@dnd-kit/core": "^6.x",
  "@blocknote/core": "latest",
  "@blocknote/react": "latest",
  "@blocknote/mantine": "latest",
  "@blocknote/xl-ai": "latest",
  "ai": "latest"
}
```

### Required Imports

```typescript
// Drag and drop
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

// BlockNote editor
import { BlockNoteEditor } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { AIExtension, AIMenuController } from "@blocknote/xl-ai";
import { en } from "@blocknote/core/locales";
import { en as aiEn } from "@blocknote/xl-ai/locales";
import { DefaultChatTransport } from "ai";

// React
import { useCallback, useId, useRef, useState, useEffect } from "react";
```

### Required CSS

```typescript
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
```

### Type Definitions

```typescript
// Item type definitions
export interface EventItem {
  id: string;
  title: string;
  timeLabel: string;
  location: string;
  sourceUrl: string;
}

export interface HomeworkItem {
  id: string;
  title: string;
  className: string;
  dueDate: string;
  sourceUrl: string;
  sourceName: string;
}

export interface OfficeHourItem {
  id: string;
  label: string;
  timeInfo: string;
  location: string;
  sourceUrl: string;
}

export interface ExamItem {
  id: string;
  title: string;
  timeInfo: string;
  location: string;
  sourceUrl: string;
}

// Drag data union type
export type DragItemData =
  | { type: "homework"; item: HomeworkItem }
  | { type: "event"; item: EventItem }
  | { type: "office_hour"; item: OfficeHourItem }
  | { type: "exam"; item: ExamItem };
```

### Utility Functions

**AI Prompt Builder** (`buildAIPrompt.ts`):
```typescript
export function buildAIPrompt(data: DragItemData): string {
  switch (data.type) {
    case "homework":
      return `Add a task item for "${data.item.title}"${data.item.className ? ` (${data.item.className})` : ""}, due ${data.item.dueDate}. Place it in the most relevant section of the briefing, or create a new section if needed.`;
    case "event":
      return `Add "${data.item.title}" to the schedule: ${data.item.timeLabel}${data.item.location ? ` at ${data.item.location}` : ""}. Place it in the most relevant section of the briefing.`;
    case "office_hour":
      return `Add office hours: ${data.item.label}, ${data.item.timeInfo}${data.item.location ? ` at ${data.item.location}` : ""}. Place it in the most relevant section of the briefing.`;
    case "exam":
      return `Add "${data.item.title}": ${data.item.timeInfo}${data.item.location ? ` in ${data.item.location}` : ""}. Place it in the most relevant section of the briefing, and add a reminder note if appropriate.`;
  }
}
```

### Sub-Components

**DraggableItem.tsx**:
```typescript
export function DraggableItem({
  id,
  data,
  children,
}: {
  id: string;
  data: DragItemData;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      {children}
    </div>
  );
}
```

**DragPreviewCard.tsx**:
```typescript
export function DragPreviewCard({ data }: { data: DragItemData }) {
  let title: string;
  let subtitle: string;

  switch (data.type) {
    case "homework":
      title = data.item.title;
      subtitle = `${data.item.className ? data.item.className + " — " : ""}due ${data.item.dueDate}`;
      break;
    case "event":
      title = data.item.title;
      subtitle = `${data.item.timeLabel}${data.item.location ? ` · ${data.item.location}` : ""}`;
      break;
    case "office_hour":
      title = data.item.label;
      subtitle = `${data.item.timeInfo}${data.item.location ? ` · ${data.item.location}` : ""}`;
      break;
    case "exam":
      title = data.item.title;
      subtitle = `${data.item.timeInfo}${data.item.location ? ` · ${data.item.location}` : ""}`;
      break;
  }

  return (
    <div className="w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg scale-105">
      <p className="text-sm font-medium text-[#171717] truncate">{title}</p>
      <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
    </div>
  );
}
```

**DroppableEditor.tsx** (simplified from DailyBriefing):
```typescript
export function DroppableEditor({
  onEditorReady,
  initialMarkdown,
  onChange,
}: {
  onEditorReady?: (editor: BlockNoteEditor<any, any, any>) => void;
  initialMarkdown: string;
  onChange?: (markdown: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "briefing-droppable" });
  const [content, setContent] = useState<any[] | null>(null);

  // Parse markdown to blocks
  useEffect(() => {
    let cancelled = false;
    async function parse() {
      const editor = BlockNoteEditor.create();
      const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown);
      if (!cancelled) setContent(blocks);
    }
    parse();
    return () => { cancelled = true; };
  }, [initialMarkdown]);

  if (!content) return <div>Loading editor...</div>;

  return (
    <div
      ref={setNodeRef}
      className={`h-full transition-colors duration-200 ${
        isOver ? "bg-orange-200" : "bg-gray-50"
      }`}
    >
      <EditorInner
        initialContent={content}
        onEditorReady={onEditorReady}
        onChange={onChange}
      />
    </div>
  );
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
    dictionary: { ...en, ai: aiEn },
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
```

## What to Leave Behind

### App-Specific Context

1. **CommentOverlayProvider** - Not part of drag/drop AI fill mechanism
2. **ExtractionTriggerButton** - Meta-feature for component extraction
3. **ChatSheet & floating dock UI** - Separate chat feature
4. **Full AgentDashboard implementation** - Data fetching, sources, agents, infinite scroll
   - Keep only the rendering of draggable cards
   - Remove agent runner, source management, tab system

### API Integration Details

1. `/api/briefing` endpoint (GET/PUT) - Editor persistence
2. Agent run actions and data fetching
3. Source management actions

### Next.js Specific

1. `dynamic()` import with `ssr: false` - Not required for extracted demo
2. Server actions from `../actions`

## Integration Plan

### Exported API Surface

```typescript
export interface DragToAIEditorProps {
  // Initial editor content
  initialMarkdown: string;

  // Items that can be dragged
  draggableItems: DragItemData[];

  // Optional callbacks
  onEditorChange?: (markdown: string) => void;
  onItemDropped?: (item: DragItemData) => void;

  // Optional AI endpoint override
  aiEndpoint?: string; // default: "/ai/regular/streamText"
}

export function DragToAIEditor(props: DragToAIEditorProps): JSX.Element;
```

### Simplified Item Card Component

The extraction should provide a basic card renderer:

```typescript
export function ItemCard({ item }: { item: DragItemData }): JSX.Element;
```

This renders different layouts based on `item.type`:
- Homework: title, className, dueDate
- Event: title, timeLabel, location
- Office Hour: label, timeInfo, location
- Exam: title, timeInfo, location

### Context Requirements

**Required Providers**: None - component is self-contained

**Global Styles**: Tailwind CSS v4 must be configured in the consuming app

### Configuration & Setup

1. **Install Dependencies**:
```bash
npm install @dnd-kit/core @blocknote/core @blocknote/react @blocknote/mantine @blocknote/xl-ai ai
```

2. **Set Up AI Endpoint**:
   - Component expects an API route at `/ai/regular/streamText` (or custom path)
   - Must return streaming text response compatible with Vercel AI SDK
   - Used by BlockNote AIExtension for content generation

3. **Include CSS**:
```typescript
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
```

### Usage Example

```typescript
import { DragToAIEditor } from "@/modules/demo-stuff";

const items: DragItemData[] = [
  {
    type: "homework",
    item: {
      id: "1",
      title: "React Assignment",
      className: "CS 101",
      dueDate: "2026-02-20",
      sourceUrl: "https://example.com",
      sourceName: "Canvas",
    },
  },
  {
    type: "event",
    item: {
      id: "2",
      title: "Guest Lecture",
      timeLabel: "Feb 18, 2pm",
      location: "Hall A",
      sourceUrl: "https://example.com",
    },
  },
];

export default function DemoPage() {
  return (
    <DragToAIEditor
      initialMarkdown="# My Daily Briefing\n\n"
      draggableItems={items}
      onEditorChange={(md) => console.log("Editor updated:", md)}
      onItemDropped={(item) => console.log("Dropped:", item)}
    />
  );
}
```

## Technical Deep Dive

### How the AI Fill Works

1. **Drag Start**:
   - `handleDragStart` captures `event.active.data.current` (DragItemData)
   - Sets `activeItem` state to display preview in DragOverlay

2. **Drag Over Editor**:
   - `useDroppable` in DroppableEditor detects hover
   - `isOver` state triggers background color transition

3. **Drop**:
   - `handleDragEnd` checks if `over.id === "briefing-droppable"`
   - Calls `buildAIPrompt(activeItem)` to generate contextual prompt
   - Retrieves AIExtension from editor: `editor.getExtension(AIExtension)`
   - Invokes AI: `ai.invokeAI({ userPrompt: prompt, useSelection: false })`

4. **AI Streaming**:
   - AIExtension sends prompt to configured endpoint
   - Receives streaming response
   - Automatically inserts generated content into editor
   - Content appears at cursor position or end of document

### Drag Performance Optimization

- **Sensor Activation**: 8px distance threshold prevents accidental drags during scrolling
- **Overlay**: `dropAnimation={null}` disables drop animation for instant feedback
- **Preview Rendering**: Pre-computed title/subtitle prevents re-renders during drag

### Editor Architecture

- **Dynamic Loading**: Editor loaded client-side only (no SSR)
- **Markdown Parsing**: Async conversion to BlockNote blocks on mount
- **Debounced Saves**: 500ms delay on changes before triggering `onChange`
- **AI Integration**: Extension registered during editor creation, accessible via `getExtension()`

## File Structure

Recommended extracted module structure:

```
src/app/modules/demo-stuff/
├── SPEC.md                    (this file)
├── page.tsx                   (demo page using the component)
├── components/
│   ├── DragToAIEditor.tsx     (main orchestrator)
│   ├── DroppableEditor.tsx    (editor with drop zone)
│   ├── DraggableItem.tsx      (drag wrapper)
│   ├── DragPreviewCard.tsx    (overlay preview)
│   ├── ItemCard.tsx           (card renderer)
│   ├── buildAIPrompt.ts       (prompt builder)
│   └── types.ts               (all type definitions)
└── README.md                  (usage docs)
```

## Implementation Checklist

- [ ] Create type definitions file with all item interfaces
- [ ] Implement `buildAIPrompt` utility function
- [ ] Create `DraggableItem` component with `useDraggable` hook
- [ ] Create `DragPreviewCard` component with type-specific rendering
- [ ] Create `DroppableEditor` with `useDroppable` and BlockNote setup
- [ ] Create `ItemCard` component for rendering draggable cards
- [ ] Create main `DragToAIEditor` orchestrator with `DndContext`
- [ ] Wire up drag handlers (`handleDragStart`, `handleDragEnd`)
- [ ] Test AI invocation flow with sample endpoint
- [ ] Create demo page with sample data
- [ ] Document AI endpoint requirements
- [ ] Add usage examples to README

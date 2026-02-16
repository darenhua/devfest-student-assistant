# Drag-and-Drop AI Fill Component Extraction Spec

## Overview

This spec describes the extraction of the **drag-and-drop card into notepad with AI fill effect** functionality from the `/modules/final` page. The system allows users to drag assignment cards (homework, events, office hours, exams) from a dashboard panel and drop them onto a rich-text editor (BlockNote), which then uses AI to intelligently insert the information into the document.

## Component Name

`Ti` (The interactive drag-and-drop system)

## Core Behavior

### Visual Flow

1. **Two-Panel Layout**
   - Left panel: A rich-text editor (BlockNote with AI extension) serving as the drop target
   - Right panel: A list of draggable items (assignments, events, office hours, exams)
   - Items can be dragged from right to left

2. **Drag Interaction**
   - When user starts dragging an item, a preview card appears following the cursor
   - The drop target (left panel/editor) changes background color when hovered (transitions to orange-200)
   - While dragging, the original item becomes semi-transparent (opacity-30)

3. **Drop & AI Fill**
   - When dropped onto the editor, the system:
     1. Builds a context-aware AI prompt based on the dropped item type and data
     2. Invokes the BlockNote AI extension with the prompt
     3. AI intelligently inserts the information into the document at an appropriate location
     4. AI decides formatting, placement, and whether to create new sections

### State Management

- **Active Drag State**: Tracks the currently dragged item (`DragItemData | null`)
- **Editor Reference**: Maintains a ref to the BlockNote editor instance to invoke AI
- **Drag Sensors**: Uses pointer sensor with 8px activation distance (prevents accidental drags)

### Side Effects

- **AI Invocation**: On drop, programmatically calls `editor.getExtension(AIExtension).invokeAI()` with a custom prompt
- **Visual Feedback**: Background color transitions on hover, drag preview overlay, opacity changes

## Dependencies to Carry

### External Packages

1. **@dnd-kit/core** (v6+)
   - `DndContext` - Root context provider for drag-and-drop
   - `DragOverlay` - Renders floating preview during drag
   - `useDraggable` - Hook for making items draggable
   - `useDroppable` - Hook for making editor a drop target
   - `useSensor`, `useSensors`, `PointerSensor` - Drag activation controls
   - Types: `DragStartEvent`, `DragEndEvent`

2. **@blocknote/core** (v0.18+)
   - `BlockNoteEditor` - Core editor instance type
   - Markdown parsing/serialization
   - Block-based document model

3. **@blocknote/react**
   - `useCreateBlockNote` - Hook to create editor instance
   - `BlockNoteView` - Editor UI component

4. **@blocknote/mantine**
   - Theme and styling for BlockNote

5. **@blocknote/xl-ai**
   - `AIExtension` - Extension that adds AI capabilities
   - `AIMenuController` - UI controls for AI features
   - Localization support

6. **ai** package
   - `DefaultChatTransport` - Handles AI streaming communication

### React Hooks & APIs

- `useState` - Active drag item, editor ready state
- `useRef` - Editor instance, debounce timers
- `useCallback` - Event handlers, editor ready callback
- `useEffect` - Initial content parsing
- `useId` - Unique DndContext ID

### CSS Requirements

- Tailwind CSS v4 (for utility classes)
- BlockNote styles:
  - `@blocknote/core/fonts/inter.css`
  - `@blocknote/mantine/style.css`
  - `@blocknote/xl-ai/style.css`

## What to Extract

### Core Components

#### 1. **DndContext Wrapper** (main orchestrator)
```typescript
- State: activeItem (DragItemData | null)
- State: editorRef (BlockNoteEditor ref)
- Handlers: onDragStart, onDragEnd
- Sensors configuration
- Child components: DraggableItems, DroppableEditor, DragOverlay
```

#### 2. **DraggableItem** (`DraggableItem.tsx`)
```typescript
- Props: id (string), data (DragItemData), children (ReactNode)
- Uses: useDraggable hook
- Styling: cursor-grab, opacity changes, drag attributes
```

#### 3. **DroppableEditor** (`DailyBriefing.tsx` → `BriefingEditor.tsx`)
```typescript
- Props: onEditorReady callback, initial markdown content
- Uses: useDroppable hook with id "briefing-droppable"
- Visual feedback: background color transition on isOver
- Editor instance: BlockNote with AIExtension
- Features: markdown parsing, auto-save, AI integration
```

#### 4. **DragPreviewCard** (`DragPreviewCard.tsx`)
```typescript
- Props: data (DragItemData)
- Renders: styled card showing item title and subtitle
- Styling: floating card with shadow, scale-105 effect
```

#### 5. **AI Prompt Builder** (`buildAIPrompt.ts`)
```typescript
- Function: buildAIPrompt(data: DragItemData) => string
- Logic: switches on item type, builds context-aware prompt
- Examples:
  - Homework: "Add task for X, due Y, place in relevant section"
  - Event: "Add X to schedule at Y time and Z location"
  - Office hour: "Add office hours info"
  - Exam: "Add exam with reminder note"
```

### Type Definitions

#### **DragItemData** (union type)
```typescript
type DragItemData =
  | { type: "homework"; item: HomeworkItem }
  | { type: "event"; item: EventItem }
  | { type: "office_hour"; item: OfficeHourItem }
  | { type: "exam"; item: ExamItem };
```

#### **Item Types**
```typescript
interface HomeworkItem {
  id: string;
  title: string;
  className: string;
  dueDate: string;
  sourceUrl: string;
  sourceName: string;
  source: "canvas" | "ext-sources";
}

interface EventItem {
  id: string;
  title: string;
  timeLabel: string;
  location: string;
  sourceUrl: string;
  source: "columbia-events";
}

interface OfficeHourItem {
  id: string;
  label: string;
  timeInfo: string;
  location: string;
  sourceUrl: string;
  source: "ext-sources";
}

interface ExamItem {
  id: string;
  title: string;
  timeInfo: string;
  location: string;
  sourceUrl: string;
  source: "ext-sources";
}
```

### Key Logic Flow

```typescript
// 1. Drag starts
function handleDragStart(event: DragStartEvent) {
  const data = event.active.data.current as DragItemData;
  setActiveItem(data); // Show preview overlay
}

// 2. Drag ends
function handleDragEnd(event: DragEndEvent) {
  if (over?.id === "briefing-droppable" && activeItem && editorRef.current) {
    // Build AI prompt from dropped data
    const prompt = buildAIPrompt(activeItem);

    // Get AI extension from editor
    const ai = editorRef.current.getExtension(AIExtension);

    // Invoke AI with custom prompt
    if (ai) {
      ai.invokeAI({ userPrompt: prompt, useSelection: false });
    }
  }
  setActiveItem(null); // Clear preview
}
```

## What to Leave Behind

### App-Specific Context

1. **CommentOverlayProvider** - Project-specific comment system wrapper
2. **ChatSheet** - Floating chat interface (unrelated to drag-drop)
3. **ExtractionTriggerButton** - Meta-component for code extraction
4. **Floating dock** - App-specific navigation buttons
5. **AgentDashboard data fetching** - Server actions for homework/events (`getEventItems`, `getHomeworkItems`, etc.)
6. **Add Source Modal** - Source management UI
7. **Agent runner hooks** - `useAgentRunner`, `useAgentStates`
8. **Tab system** - Multi-tab navigation specific to this app
9. **Infinite scroll** - Pagination logic in lists

### What Should Be Props Instead

- **Draggable items data**: Should be passed as props, not fetched
- **Initial editor content**: Should be prop-driven
- **Editor persistence**: onChange callback should be provided by consumer
- **AI API endpoint**: Should be configurable

## Integration Plan

### Exported Components

#### **Main Component: `TiDragDropAIEditor`**

```typescript
interface TiDragDropAIEditorProps {
  // Editor configuration
  initialMarkdown: string;
  onMarkdownChange?: (markdown: string) => void;
  aiApiEndpoint?: string; // Default: "/ai/regular/streamText"

  // Draggable items
  items: DragItemData[];

  // Render props for customization
  renderDraggableItem: (item: DragItemData) => React.ReactNode;

  // Optional callbacks
  onItemDropped?: (item: DragItemData) => void;
  onEditorReady?: (editor: BlockNoteEditor) => void;

  // Layout customization
  editorClassName?: string;
  itemsClassName?: string;
}
```

#### **Standalone Components**

```typescript
// Can be used independently
export { DraggableItem } from './DraggableItem';
export { DragPreviewCard } from './DragPreviewCard';
export { buildAIPrompt } from './buildAIPrompt';

// Types
export type { DragItemData, HomeworkItem, EventItem, OfficeHourItem, ExamItem };
```

### Usage Example

```typescript
import { TiDragDropAIEditor, type DragItemData } from '@/modules/ti-dnd';

function MyApp() {
  const [markdown, setMarkdown] = useState("# My Notes\n\n");

  const items: DragItemData[] = [
    {
      type: "homework",
      item: {
        id: "hw1",
        title: "Complete Lab 3",
        className: "CS 101",
        dueDate: "2024-03-15",
        sourceUrl: "https://...",
        sourceName: "Canvas",
        source: "canvas"
      }
    },
    // ... more items
  ];

  return (
    <TiDragDropAIEditor
      initialMarkdown={markdown}
      onMarkdownChange={setMarkdown}
      items={items}
      renderDraggableItem={(item) => (
        <div className="p-2 border rounded">
          {item.type === "homework" ? item.item.title : item.item.title}
        </div>
      )}
      onItemDropped={(item) => {
        console.log("Dropped:", item);
      }}
    />
  );
}
```

### Required Setup

#### 1. **AI API Endpoint**

The consumer must provide an AI endpoint compatible with the `ai` package's `DefaultChatTransport`:

```typescript
// app/ai/regular/streamText/route.ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4'),
    messages,
  });

  return result.toDataStreamResponse();
}
```

#### 2. **Tailwind Configuration**

Ensure Tailwind is configured to include the module's components:

```javascript
// tailwind.config.js
export default {
  content: [
    "./src/app/modules/ti-dnd/**/*.{ts,tsx}",
    // ... other paths
  ],
};
```

#### 3. **Package Installation**

```bash
bun add @dnd-kit/core @blocknote/core @blocknote/react @blocknote/mantine @blocknote/xl-ai ai
```

### Configuration Options

```typescript
interface TiConfig {
  // Drag activation distance (default: 8px)
  dragActivationDistance?: number;

  // Drop zone styling
  dropzoneHoverColor?: string; // Default: "bg-orange-200"
  dropzoneDefaultColor?: string; // Default: "bg-gray-50"

  // Drag preview styling
  dragPreviewScale?: number; // Default: 1.05

  // Editor options
  editorTheme?: "light" | "dark";
  editorPadding?: { top: number; bottom: number };

  // AI options
  aiPromptBuilder?: (data: DragItemData) => string;
}
```

## Technical Notes

### How the AI Fill Works

1. **Extension Architecture**: BlockNote uses an extension system. The `AIExtension` adds AI capabilities to the editor.

2. **Programmatic Invocation**: Unlike typical AI interfaces where users click a button, this system programmatically invokes AI via `editor.getExtension(AIExtension).invokeAI()`.

3. **Prompt Engineering**: The `buildAIPrompt` function creates contextual prompts that tell the AI:
   - What information to add
   - Where to place it ("in the most relevant section")
   - What format to use (task item, schedule entry, etc.)

4. **Streaming Response**: The AI uses streaming via the `DefaultChatTransport`, providing real-time feedback as content is generated.

5. **Smart Placement**: The AI analyzes the existing document structure and decides where to insert content, potentially creating new sections if needed.

### Performance Considerations

- **Dynamic Import**: BriefingEditor is dynamically imported with `next/dynamic` to avoid SSR issues with BlockNote
- **Debounced Saves**: Editor changes are debounced (500ms) before calling onChange callback
- **Activation Distance**: 8px drag activation prevents accidental drags
- **Drop Animation**: Set to `null` for instant feedback

### Accessibility Considerations

- Drag handles use proper ARIA attributes via `@dnd-kit/core`
- Keyboard navigation should be added for non-pointer users
- Consider adding screen reader announcements for drag/drop actions

## Implementation Checklist

- [ ] Extract DraggableItem component
- [ ] Extract DragPreviewCard component
- [ ] Extract DroppableEditor (BriefingEditor) component
- [ ] Extract buildAIPrompt utility
- [ ] Extract type definitions
- [ ] Create main TiDragDropAIEditor wrapper component
- [ ] Add prop-based configuration
- [ ] Remove app-specific dependencies
- [ ] Create usage documentation
- [ ] Add AI endpoint setup instructions
- [ ] Create example implementation
- [ ] Add keyboard navigation support
- [ ] Add accessibility features
- [ ] Write unit tests for prompt builder
- [ ] Write integration tests for drag-drop flow

## Questions for Consumer

Before implementation, clarify:

1. Should the editor support multiple drop zones or just one?
2. Should drag preview be customizable per item type?
3. Do you want built-in persistence or purely controlled component?
4. Should there be undo/redo for AI insertions?
5. Do you need support for dragging from editor back to list?
6. Should there be a confirmation step before AI insertion?

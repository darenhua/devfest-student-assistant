# Drag-and-Drop AI Fill Component Extraction Spec

## Overview

The target component is the **FinalPage** component (lines 31-131 in `/src/app/modules/final/page.tsx`), which implements a sophisticated drag-and-drop system that allows users to drag cards representing homework assignments, events, office hours, and exams from a dashboard into a markdown editor, triggering AI-powered content generation.

## Core Functionality

### What This Component Does

1. **Two-Panel Layout**: Split screen with a markdown editor (left) and an item dashboard (right)
2. **Drag-and-Drop System**: Items from the right panel can be dragged and dropped onto the left panel
3. **AI Integration**: When an item is dropped on the editor, it triggers an AI extension that generates contextual markdown content
4. **Visual Feedback**:
   - Dragging shows a floating preview card
   - Drop zone highlights with orange background when hovering
   - Original item becomes semi-transparent while dragging

### The Drag-and-Drop Flow

```
User starts dragging card
  ↓
DndContext captures drag start → stores item data in state
  ↓
DragOverlay shows floating preview card
  ↓
Drop zone (editor) highlights orange when card hovers over it
  ↓
User drops card on editor
  ↓
DndContext captures drag end → builds AI prompt from item data
  ↓
AI Extension invoked with prompt → generates markdown content
  ↓
Content appears in editor at cursor position
```

### Key Technical Details

**Drag System Architecture:**
- Uses `@dnd-kit/core` for drag-and-drop
- `DndContext` wraps the entire layout
- `PointerSensor` with 8px activation distance (prevents accidental drags)
- `useDraggable` hook on dashboard items
- `useDroppable` hook on editor area

**AI Integration:**
- Uses BlockNote editor with `@blocknote/xl-ai` extension
- AI extension configured with custom transport: `/ai/regular/streamText`
- Prompt generation based on item type (homework, event, office hour, exam)
- AI invocation: `editor.getExtension(AIExtension).invokeAI({ userPrompt, useSelection: false })`

**State Management:**
- `activeItem`: Currently dragging item (null when not dragging)
- `editorRef`: Reference to BlockNote editor instance for AI invocation
- `chatOpen`: Controls chat sheet visibility (separate feature)

## What to Extract

### Core Components to Extract

1. **Main Orchestrator Component** (FinalPage)
   - DndContext setup with sensors
   - Drag event handlers (onDragStart, onDragEnd)
   - Two-panel layout structure
   - DragOverlay for preview

2. **DailyBriefing Component**
   - Droppable editor area
   - Visual feedback on hover (orange background)
   - BlockNote editor with AI extension
   - Editor ready callback for parent access

3. **BriefingEditor Component**
   - BlockNote editor configuration
   - AI extension setup with transport
   - Markdown parsing and serialization
   - Auto-save debouncing (500ms)

4. **AgentDashboard Component**
   - Item rendering with drag support
   - Tab system for filtering items
   - Infinite scroll pagination
   - Item types: homework, events, office hours, exams

5. **Supporting Components**
   - `DraggableItem`: Wrapper for draggable items
   - `DragPreviewCard`: Floating preview during drag
   - `AssignmentCard`: Card display for homework items
   - Item row components (EventRow, HomeworkRow, OfficeHourRow, ExamRow)

6. **Utility Functions**
   - `buildAIPrompt`: Converts item data to AI prompt based on type

### Data Structures

```typescript
// Drag item data (discriminated union)
type DragItemData =
  | { type: "homework"; item: HomeworkItem }
  | { type: "event"; item: EventItem }
  | { type: "office_hour"; item: OfficeHourItem }
  | { type: "exam"; item: ExamItem };

// Item types
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

### Visual Behavior

**Drag States:**
- **Idle**: Items show cursor-grab, normal opacity
- **Dragging**: Original item 30% opacity, cursor-grabbing
- **Hovering over drop zone**: Editor background changes to orange-200
- **Preview**: Floating card with scale-105, shadow-lg, 64px width

**Layout:**
- Split screen with 1px divider
- Left panel: white background, flex-1
- Right panel: gray-50/50 background, flex-1
- Floating dock at bottom center (optional UI, not core to drag-drop)

## Dependencies to Carry

### NPM Packages (Required)

```json
{
  "@dnd-kit/core": "^6.x",
  "@blocknote/core": "^0.x",
  "@blocknote/react": "^0.x",
  "@blocknote/mantine": "^0.x",
  "@blocknote/xl-ai": "^0.x",
  "ai": "latest",
  "react": "^19.x",
  "lucide-react": "latest"
}
```

### Stylesheets (Required)

```typescript
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
```

### UI Components (shadcn/ui)

- `Button` from `@/components/ui/button`
- `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle` from `@/components/ui/sheet`

### React Hooks Used

- `useState`, `useCallback`, `useRef`, `useEffect`, `useId` from React
- `useSensor`, `useSensors`, `useDraggable`, `useDroppable` from @dnd-kit/core
- `useCreateBlockNote` from @blocknote/react

### Type Imports

```typescript
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import type { BlockNoteEditor } from "@blocknote/core";
```

## What to Leave Behind

### App-Specific Features (DO NOT extract)

1. **CommentOverlayProvider** - Specific to parent app's comment system
2. **ExtractionTriggerButton** - Meta-feature for component extraction
3. **ChatSheet** - Separate chat feature unrelated to drag-drop
4. **Floating Dock** - Optional UI element not core to drag-drop functionality
5. **Data Fetching Logic** - The `actions.ts` imports (`getEventItems`, `getHomeworkItems`, etc.)
6. **Agent System** - The `useAgentRunner`, `AgentView`, auto-mode features
7. **Source Management** - `AddSourceModal`, `addSource`, `getSources` functions
8. **API Routes** - `/api/briefing` endpoints (briefing persistence)

### Context-Specific Implementations

- The specific agent tabs (homework, office_hours, events, exams)
- The infinite scroll pagination (can be simplified to basic list)
- The fixtures.ts dummy data
- The specific AI transport endpoint `/ai/regular/streamText` (should be configurable)

## Integration Plan

### Props API Design

The extracted component should expose a clean, generic API:

```typescript
interface DragToEditorProps {
  // Item configuration
  items: DraggableItemData[];

  // Editor configuration
  initialMarkdown?: string;
  onMarkdownChange?: (markdown: string) => void;

  // AI configuration
  aiEndpoint?: string; // Default: "/ai/regular/streamText"
  buildPrompt?: (item: DraggableItemData) => string;

  // Customization
  renderItem?: (item: DraggableItemData) => React.ReactNode;
  renderPreview?: (item: DraggableItemData) => React.ReactNode;

  // Layout options
  editorClassName?: string;
  dashboardClassName?: string;
}

// Generic item structure
interface DraggableItemData {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, any>;
}
```

### Usage Example

```typescript
import { DragToEditor } from '@/modules/first';

function MyApp() {
  const items = [
    {
      id: '1',
      type: 'task',
      title: 'Complete assignment',
      subtitle: 'Due tomorrow',
      metadata: { priority: 'high' }
    },
    // ...
  ];

  return (
    <DragToEditor
      items={items}
      initialMarkdown="# My Daily Briefing\n"
      onMarkdownChange={(md) => console.log(md)}
      buildPrompt={(item) => `Add task: ${item.title}`}
    />
  );
}
```

### Required Setup in Consumer App

1. **Install dependencies:**
   ```bash
   bun add @dnd-kit/core @blocknote/core @blocknote/react @blocknote/mantine @blocknote/xl-ai ai
   ```

2. **Create AI endpoint** at `/ai/regular/streamText` or pass custom endpoint:
   ```typescript
   // app/ai/regular/streamText/route.ts
   export async function POST(req: Request) {
     // Implementation using Vercel AI SDK or similar
   }
   ```

3. **Add CSS imports** to layout or component:
   ```typescript
   import "@blocknote/core/fonts/inter.css";
   import "@blocknote/mantine/style.css";
   import "@blocknote/xl-ai/style.css";
   ```

4. **Ensure Tailwind CSS** is configured with necessary classes

### File Structure for Extracted Module

```
src/app/modules/first/
├── page.tsx                    # Main demo/example page
├── components/
│   ├── DragToEditor.tsx       # Main orchestrator
│   ├── EditorPanel.tsx        # Left panel with droppable editor
│   ├── ItemDashboard.tsx      # Right panel with draggable items
│   ├── BriefingEditor.tsx     # BlockNote editor setup
│   ├── DraggableItem.tsx      # Drag wrapper component
│   ├── DragPreviewCard.tsx    # Preview overlay
│   └── types.ts               # TypeScript types
├── utils/
│   └── promptBuilder.ts       # Default prompt generation
└── README.md                  # Usage documentation
```

### Configuration Options

The component should be configurable for:

1. **Custom Item Types**: Not hardcoded to homework/events/exams
2. **Custom Prompts**: User-provided prompt builder function
3. **Custom Rendering**: Override item card appearance
4. **AI Provider**: Configurable endpoint (OpenAI, Anthropic, local)
5. **Drag Constraints**: Activation distance, multi-drag, etc.
6. **Editor Options**: Theme, toolbar, extensions

### Key Integration Points

**Data Flow:**
```
Consumer App → items array → ItemDashboard → DraggableItem
                                                ↓
                                            Drag Start
                                                ↓
                                          DragOverlay
                                                ↓
                                            Drop on Editor
                                                ↓
Consumer buildPrompt fn → AI Extension → Editor update
                                                ↓
Consumer onMarkdownChange callback ← Updated markdown
```

**Event Flow:**
1. Consumer provides items and callbacks
2. User drags item
3. Component captures drag data
4. User drops on editor
5. Component builds prompt (using consumer fn or default)
6. Component invokes AI
7. AI generates content
8. Editor updates
9. Component calls onMarkdownChange with new markdown

## Advanced Features to Consider

### Optional Enhancements

1. **Multi-select drag**: Drag multiple items at once
2. **Drag constraints**: Restrict which items can be dropped where
3. **Custom drop zones**: Multiple editors or areas
4. **Undo/redo**: Editor history management
5. **Drag animations**: Spring physics, easing
6. **Keyboard shortcuts**: Accessibility
7. **Mobile support**: Touch events
8. **Collaborative editing**: Multi-user support

### Performance Considerations

1. **Virtualization**: For large item lists (current uses infinite scroll)
2. **Debouncing**: Editor change callbacks (currently 500ms)
3. **Lazy loading**: Dynamic component imports
4. **Memoization**: Prevent unnecessary re-renders

## Testing Strategy

### Key Scenarios to Test

1. **Drag lifecycle**:
   - Start drag → preview appears
   - Hover over editor → background changes
   - Drop → AI triggers → content appears
   - Cancel drag (ESC) → state resets

2. **AI integration**:
   - Successful AI generation
   - AI error handling
   - Streaming response display

3. **Editor persistence**:
   - Markdown save/load
   - Editor state preservation
   - Concurrent edits

4. **Edge cases**:
   - Empty item list
   - Missing AI endpoint
   - Slow network
   - Large markdown document

## Implementation Notes

### Critical Implementation Details

1. **Editor Ref Management**: The parent must maintain a ref to the BlockNote editor instance to invoke AI programmatically. This is done via the `onEditorReady` callback.

2. **Unique DndContext ID**: Use `useId()` to generate unique IDs for DndContext to avoid conflicts with multiple instances.

3. **Activation Constraint**: 8px distance prevents accidental drags when clicking links or buttons within cards.

4. **Drop Zone ID**: The droppable area must have ID "briefing-droppable" (or make configurable).

5. **AI Extension Access**: Must call `editor.getExtension(AIExtension)` to access the AI functionality.

6. **Markdown Parsing**: BlockNote requires async parsing with `tryParseMarkdownToBlocks`.

7. **Two-Stage Rendering**: BriefingEditor parses markdown first, then renders EditorInner with blocks to avoid hydration issues.

### Potential Pitfalls

1. **SSR Issues**: BlockNote editor must be client-side only (use `dynamic` import with `ssr: false`)
2. **AI Endpoint**: Must match the transport configuration exactly
3. **CSS Import Order**: BlockNote styles must be imported before custom styles
4. **Memory Leaks**: Clean up IntersectionObserver in infinite scroll
5. **Type Safety**: DragItemData discriminated union must be exhaustive

## Summary

This component demonstrates a sophisticated drag-and-drop pattern integrated with AI content generation. The key insight is using the drag data payload to construct contextual AI prompts that generate relevant markdown content. The extraction should focus on making this pattern generic and reusable while preserving the smooth UX and visual feedback that makes it intuitive.

The component is well-architected with clear separation of concerns:
- DndContext handles drag orchestration
- DraggableItem/useDroppable handle individual interactions
- BlockNote + AI extension handle content generation
- Parent component coordinates between them

By extracting this pattern, other developers can implement similar "drag-to-generate" workflows for documentation, note-taking, planning, and other AI-augmented authoring experiences.

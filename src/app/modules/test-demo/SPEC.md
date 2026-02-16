# Drag-and-Drop AI Fill Extraction Spec

## Overview

This spec documents the extraction of a **drag-and-drop to AI fill** system from the `final` module. The core functionality allows users to drag cards (homework, events, office hours, exams) from a dashboard and drop them onto a markdown editor, which triggers an AI extension to automatically insert formatted content into the document.

## Developer's Intent

The developer wants to understand and extract the mechanism that enables:
1. Dragging cards from a list
2. Dropping them onto a target area (markdown editor)
3. Triggering an AI extension that intelligently inserts content based on the dragged item

## How It Works (Technical Flow)

### 1. **Drag System Architecture**

The system uses `@dnd-kit/core` for drag-and-drop with the following components:

```
DndContext (top-level coordinator)
  ├─> DraggableItem (source items in right panel)
  ├─> Droppable area (left panel editor)
  └─> DragOverlay (floating preview during drag)
```

### 2. **Data Flow**

```
User starts drag
  ↓
DraggableItem captures item data (type + item details)
  ↓
FinalPage.handleDragStart() stores activeItem state
  ↓
DragOverlay shows preview card while dragging
  ↓
User drops over editor droppable zone
  ↓
FinalPage.handleDragEnd() checks if over === "briefing-droppable"
  ↓
buildAIPrompt() converts item data to natural language prompt
  ↓
AIExtension.invokeAI() receives prompt
  ↓
BlockNote AI fills content into editor at cursor
```

### 3. **Key Components**

#### **DraggableItem** (`DraggableItem.tsx`)
- Wraps any child content to make it draggable
- Attaches item data (type + details) to the drag event
- Uses `useDraggable` hook from `@dnd-kit/core`
- Props: `id` (string), `data` (DragItemData), `children` (ReactNode)

#### **DailyBriefing** (`DailyBriefing.tsx`)
- Renders the BlockNote editor
- Uses `useDroppable` to create a drop zone with id `"briefing-droppable"`
- Changes background color when hovered during drag (`isOver` state)
- Exposes editor instance via `onEditorReady` callback

#### **BriefingEditor** (`BriefingEditor.tsx`)
- BlockNote editor with AI extension configured
- Uses `AIExtension` from `@blocknote/xl-ai`
- Connected to API endpoint `/ai/regular/streamText`
- Parses markdown to BlockNote blocks on mount
- Supports programmatic AI invocation via `editor.getExtension(AIExtension).invokeAI()`

#### **FinalPage** (orchestrator)
- Wraps everything in `DndContext`
- Maintains `activeItem` state for drag preview
- Stores `editorRef` to access editor from drag handler
- `handleDragEnd`: checks drop target and triggers AI if valid
- Uses `buildAIPrompt` to convert item data to AI instruction

#### **buildAIPrompt** (`buildAIPrompt.ts`)
- Pure function that maps `DragItemData` to natural language prompts
- Each item type (homework, event, office_hour, exam) has a custom prompt template
- Prompts instruct the AI to place content in "most relevant section" or create new section

#### **DragPreviewCard** (`DragPreviewCard.tsx`)
- Renders a floating card during drag (shown in `DragOverlay`)
- Displays title and subtitle based on item type
- Styled with shadow and scale for visual feedback

### 4. **Critical Integration Points**

#### **AI Extension Setup**
```typescript
AIExtension({
  transport: new DefaultChatTransport({
    api: "/ai/regular/streamText",
  }),
})
```

#### **AI Invocation**
```typescript
const ai = editor.getExtension(AIExtension);
if (ai) {
  ai.invokeAI({
    userPrompt: prompt,
    useSelection: false  // Insert at cursor, not replace selection
  });
}
```

#### **Droppable Area**
```typescript
const { setNodeRef, isOver } = useDroppable({ id: "briefing-droppable" });
```

#### **Drag Detection**
```typescript
if (over?.id === "briefing-droppable" && activeItem && editorRef.current) {
  // Trigger AI
}
```

## What to Extract

### Core Functionality
1. **Drag-and-drop system** using `@dnd-kit/core`
2. **AI-powered editor** using `@blocknote/core`, `@blocknote/mantine`, `@blocknote/xl-ai`
3. **Prompt builder** that converts structured data to AI instructions
4. **Visual feedback** (preview card, drop zone highlighting)

### Component Structure
- `DndDemoPage.tsx` - Main orchestrator (like FinalPage)
- `DraggableCard.tsx` - Generic draggable wrapper
- `AIEditor.tsx` - BlockNote editor with AI extension
- `DropZone.tsx` - Droppable area wrapper
- `DragPreview.tsx` - Floating preview component
- `buildPrompt.ts` - Prompt generation utility
- `types.ts` - Type definitions

### Visual Elements
- Cards with drag cursor (`cursor-grab`, `active:cursor-grabbing`)
- Opacity change during drag (`opacity-30`)
- Drop zone visual feedback (background color change)
- Floating preview with shadow and scale effect
- Smooth transitions

## Dependencies to Carry

### NPM Packages (Required)
```json
{
  "@dnd-kit/core": "^6.x",
  "@blocknote/core": "latest",
  "@blocknote/react": "latest",
  "@blocknote/mantine": "latest",
  "@blocknote/xl-ai": "latest",
  "ai": "latest"  // For DefaultChatTransport
}
```

### Peer Dependencies
- `react` (19.x from project)
- `react-dom`
- Next.js (for dynamic imports, API routes)

### CSS/Styles
```typescript
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "@blocknote/xl-ai/style.css";
```

### Type Definitions
```typescript
import type {
  DragStartEvent,
  DragEndEvent
} from "@dnd-kit/core";

import type { BlockNoteEditor } from "@blocknote/core";
```

### API Endpoint
- Must provide `/ai/regular/streamText` endpoint that:
  - Accepts POST requests with AI prompts
  - Returns streaming text responses
  - Compatible with `DefaultChatTransport` from `ai` package

## What to Leave Behind

### App-Specific Features
1. **Multiple item types** - Simplify to one generic card type
2. **Real data fetching** - Use mock/fixture data
3. **Source management** - Not relevant to drag-and-drop demo
4. **Agent dashboard** - Full implementation not needed
5. **Infinite scroll** - Unnecessary for demo
6. **Floating dock** - App-specific UI
7. **Chat sheet** - Unrelated feature
8. **Comment overlay** - Unrelated feature
9. **Extraction trigger button** - Unrelated feature

### Complex State Management
- Agent runner hooks
- Auto-mode functionality
- Tab switching for different item types
- Source URL management
- Persistence to API endpoints (briefing save)

### School-Specific Logic
- Class names, due dates
- Office hours parsing
- Event/exam structures
- Calendar integration concepts

## Integration Plan

### Extracted Component API

#### **DndDemoPage Component**
```typescript
export default function DndDemoPage() {
  // Self-contained, no props needed
  // Renders complete demo
}
```

### Internal Structure

#### **Sample Data Type**
```typescript
interface DemoCard {
  id: string;
  title: string;
  description: string;
  category?: string;
}

type DragData = {
  type: "card";
  item: DemoCard;
};
```

#### **Prompt Builder**
```typescript
function buildPrompt(data: DragData): string {
  return `Add a new item: "${data.item.title}" - ${data.item.description}.
  Place it in the most relevant section or create a new section if needed.`;
}
```

#### **Component Hierarchy**
```
DndDemoPage
  ├─> DndContext
  │     ├─> LeftPanel (DropZone + AIEditor)
  │     ├─> RightPanel (List of DraggableCards)
  │     └─> DragOverlay (DragPreview)
  └─> (No other dependencies)
```

### Configuration Requirements

#### **1. AI Endpoint Setup**
Consumers must provide an API route at `/ai/regular/streamText` (or configure transport URL):

```typescript
// app/ai/regular/streamText/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = streamText({
    model: openai('gpt-4'),
    prompt,
  });

  return result.toDataStreamResponse();
}
```

#### **2. No Context Providers Needed**
The component is fully self-contained - no external context required.

#### **3. Styling**
- Uses Tailwind CSS (already in project)
- BlockNote brings its own CSS (imported in component)
- No additional theme provider needed

### Usage Example

```typescript
// app/modules/test-demo/page.tsx
import DndDemoPage from './DndDemoPage';

export default function Page() {
  return <DndDemoPage />;
}
```

### Customization Points

1. **Card Data**: Replace `DemoCard` type and sample data
2. **Prompt Generation**: Modify `buildPrompt()` for different AI behaviors
3. **Visual Style**: Customize colors, shadows, transitions
4. **Editor Initial Content**: Change default markdown
5. **AI Model**: Configure transport to use different AI endpoint/model

### Testing Checklist

- [ ] Can drag cards from right panel
- [ ] Drop zone highlights on hover
- [ ] Preview card follows cursor during drag
- [ ] Dropping on editor triggers AI
- [ ] AI inserts content in editor
- [ ] Dropping outside editor cancels drag
- [ ] Multiple drags work sequentially
- [ ] Editor content persists between drags

## Implementation Notes

### Critical Gotchas

1. **Editor Ref Timing**: Editor must be fully initialized before drag can trigger AI. Use `onEditorReady` callback pattern.

2. **Droppable ID**: Must match exactly between `useDroppable({ id })` and `over?.id` check.

3. **AI Extension Access**: Must call `editor.getExtension(AIExtension)` - not available in standard BlockNote editor.

4. **Dynamic Import**: BriefingEditor must use `dynamic` import with `ssr: false` because BlockNote is client-only.

5. **Unique DndContext ID**: Use `useId()` for DndContext to avoid SSR hydration issues.

6. **Sensor Configuration**: `PointerSensor` with `activationConstraint: { distance: 8 }` prevents accidental drags on click.

### Performance Considerations

- Editor initialization is async (markdown parsing)
- AI invocation may take 1-5 seconds
- No loading states needed for drag (instant feedback)
- Consider debouncing if adding auto-save

### Accessibility

- Drag-and-drop is mouse/touch only in this implementation
- For keyboard accessibility, would need to add keyboard handlers
- Screen reader support not implemented in source

## Example Simplified Implementation

### Minimal Working Demo (High-Level Pseudocode)

```typescript
function DndDemoPage() {
  const [activeItem, setActiveItem] = useState(null);
  const editorRef = useRef(null);

  // Sample data
  const cards = [
    { id: "1", title: "Task 1", description: "Do something" },
    { id: "2", title: "Task 2", description: "Do something else" },
  ];

  function handleDragEnd(event) {
    if (event.over?.id === "editor-drop" && activeItem && editorRef.current) {
      const prompt = `Add: ${activeItem.title} - ${activeItem.description}`;
      const ai = editorRef.current.getExtension(AIExtension);
      ai?.invokeAI({ userPrompt: prompt, useSelection: false });
    }
    setActiveItem(null);
  }

  return (
    <DndContext onDragStart={e => setActiveItem(e.active.data.current)}
                onDragEnd={handleDragEnd}>
      <div className="flex">
        {/* Left: Editor with drop zone */}
        <DropZone id="editor-drop">
          <AIEditor onReady={editor => editorRef.current = editor} />
        </DropZone>

        {/* Right: Draggable cards */}
        <div>
          {cards.map(card => (
            <DraggableCard key={card.id} data={card}>
              {card.title}
            </DraggableCard>
          ))}
        </div>
      </div>

      {/* Preview */}
      <DragOverlay>
        {activeItem && <PreviewCard data={activeItem} />}
      </DragOverlay>
    </DndContext>
  );
}
```

## References to Source Files

- Main orchestrator: `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/page.tsx`
- Draggable wrapper: `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/components/DraggableItem.tsx`
- Drop zone + editor: `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/components/DailyBriefing.tsx`
- AI editor setup: `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/components/BriefingEditor.tsx`
- Prompt builder: `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/components/buildAIPrompt.ts`
- Type definitions: `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/components/types.ts`
- Preview card: `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/components/DragPreviewCard.tsx`

## Success Criteria

The extracted component successfully demonstrates the drag-and-drop AI fill pattern when:

1. ✅ User can drag cards with smooth visual feedback
2. ✅ Drop zone provides clear hover indication
3. ✅ AI automatically fills content on successful drop
4. ✅ Content appears in editor without manual input
5. ✅ AI places content intelligently based on prompt
6. ✅ Component works as standalone module
7. ✅ No dependencies on parent app state
8. ✅ Clear, documented API for customization

# DragToEditor - Drag-and-Drop AI Content Generation Module

A sophisticated React component that enables drag-and-drop interactions between a dashboard of items and a markdown editor, with AI-powered content generation upon drop.

## Overview

This module extracts the core drag-and-drop AI editing functionality from the FinalPage component into a reusable, generic module that can be integrated into any application.

### Key Features

- **🎯 Drag-and-Drop System**: Intuitive drag from item dashboard to markdown editor
- **🤖 AI Integration**: Automatic content generation when items are dropped
- **📝 Rich Text Editor**: BlockNote-powered markdown editor with AI extension
- **🎨 Visual Feedback**: Hover states, drag previews, and smooth animations
- **⚙️ Highly Configurable**: Custom prompts, rendering, styling, and behavior
- **📦 Self-Contained**: All dependencies and utilities included

## Architecture

```
┌─────────────────────────────────────────────────┐
│              DragToEditor                        │
│  ┌─────────────────┐  ┌────────────────────┐   │
│  │   EditorPanel   │  │   ItemDashboard    │   │
│  │  (Droppable)    │  │   (Draggable)      │   │
│  │                 │  │                    │   │
│  │ BriefingEditor  │  │  - Item 1          │   │
│  │  - BlockNote    │  │  - Item 2          │   │
│  │  - AI Extension │  │  - Item 3          │   │
│  │                 │  │  - Item 4          │   │
│  └─────────────────┘  └────────────────────┘   │
│           │                    │                │
│           └────────┬───────────┘                │
│                    ↓                            │
│            DragPreviewCard                      │
└─────────────────────────────────────────────────┘
```

## Component Structure

```
src/app/modules/first/
├── page.tsx                          # Demo page with example usage
├── components/
│   ├── DragToEditor.tsx             # Main orchestrator component
│   ├── EditorPanel.tsx              # Droppable editor container
│   ├── ItemDashboard.tsx            # List of draggable items
│   ├── BriefingEditor.tsx           # BlockNote editor with AI
│   ├── DraggableItem.tsx            # Drag wrapper component
│   ├── DragPreviewCard.tsx          # Floating drag preview
│   └── types.ts                     # TypeScript definitions
├── utils/
│   └── promptBuilder.ts             # AI prompt generation utilities
└── README.md                        # This file
```

## Installation

### 1. Install Dependencies

```bash
npm install @dnd-kit/core @blocknote/core @blocknote/react @blocknote/mantine @blocknote/xl-ai ai lucide-react
```

Or with bun:

```bash
bun add @dnd-kit/core @blocknote/core @blocknote/react @blocknote/mantine @blocknote/xl-ai ai lucide-react
```

### 2. Create AI Endpoint

Create an API route at `/app/ai/regular/streamText/route.ts`:

```typescript
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const result = await streamText({
    model: openai("gpt-4-turbo"),
    system: "You are a helpful assistant that generates markdown content.",
    prompt,
  });

  return result.toDataStreamResponse();
}
```

### 3. Add Required Styles

The BlockNote styles are automatically imported by the BriefingEditor component:
- `@blocknote/core/fonts/inter.css`
- `@blocknote/mantine/style.css`
- `@blocknote/xl-ai/style.css`

## Usage

### Basic Example

```tsx
import { DragToEditor } from "@/app/modules/first/components/DragToEditor";
import type { DraggableItemData } from "@/app/modules/first/components/types";

const items: DraggableItemData[] = [
  {
    id: "1",
    type: "task",
    title: "Complete project",
    subtitle: "Due tomorrow",
    metadata: { priority: "high" },
  },
  {
    id: "2",
    type: "note",
    title: "Meeting notes",
    subtitle: "Team standup",
  },
];

export default function MyApp() {
  return (
    <DragToEditor
      items={items}
      initialMarkdown="# My Document\n"
      onMarkdownChange={(md) => console.log(md)}
    />
  );
}
```

### Advanced Example with Custom Rendering

```tsx
import { DragToEditor } from "@/app/modules/first/components/DragToEditor";
import type { DraggableItemData, DragItemData } from "@/app/modules/first/components/types";

function CustomItemCard({ item }: { item: DraggableItemData }) {
  return (
    <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg">
      <h3 className="font-bold">{item.title}</h3>
      <p className="text-sm">{item.subtitle}</p>
    </div>
  );
}

function CustomPreview({ data }: { data: DragItemData }) {
  return (
    <div className="p-3 bg-yellow-200 rounded-lg shadow-2xl">
      <p className="font-bold">✨ {data.item.title}</p>
    </div>
  );
}

export default function MyApp() {
  return (
    <DragToEditor
      items={items}
      renderItem={(item) => <CustomItemCard item={item} />}
      renderPreview={(data) => <CustomPreview data={data} />}
      buildPrompt={(data) => `Add this awesome item: ${data.item.title}`}
      aiEndpoint="/api/custom-ai"
      theme="dark"
    />
  );
}
```

## API Reference

### DragToEditor Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `DraggableItemData[]` | **Required** | Array of items to display in dashboard |
| `initialMarkdown` | `string` | `"# Daily Briefing\n..."` | Initial markdown content |
| `onMarkdownChange` | `(md: string) => void` | `undefined` | Callback when markdown changes |
| `aiEndpoint` | `string` | `"/ai/regular/streamText"` | AI API endpoint |
| `buildPrompt` | `(data: DragItemData) => string` | `buildAIPrompt` | Custom prompt builder |
| `renderItem` | `(item: DraggableItemData) => ReactNode` | `DefaultItemCard` | Custom item renderer |
| `renderPreview` | `(data: DragItemData) => ReactNode` | `DragPreviewCard` | Custom preview renderer |
| `editorClassName` | `string` | `undefined` | Custom editor panel classes |
| `dashboardClassName` | `string` | `undefined` | Custom dashboard classes |
| `dashboardTitle` | `string` | `"Items"` | Dashboard header title |
| `dropZoneId` | `string` | `"briefing-droppable"` | Drop zone identifier |
| `theme` | `"light" \| "dark"` | `"light"` | Editor theme |
| `activationDistance` | `number` | `8` | Pixels to drag before activating |

### Type Definitions

#### DraggableItemData

```typescript
interface DraggableItemData {
  id: string;              // Unique identifier
  type: string;            // Item type (task, note, event, etc.)
  title: string;           // Main text
  subtitle?: string;       // Secondary text
  metadata?: Record<string, any>;  // Additional data
}
```

#### DragItemData

```typescript
interface DragItemData {
  type: string;            // Item type
  item: DraggableItemData; // Full item data
}
```

## Customization

### Custom Prompt Builder

```typescript
import { createPromptBuilder, promptBuilders } from "@/app/modules/first/utils/promptBuilder";

const myPromptBuilder = createPromptBuilder({
  task: (data) => `Add task: ${data.item.title} with priority ${data.item.metadata?.priority}`,
  note: (data) => `Add note: ${data.item.title}`,
  // Add more types...
});

<DragToEditor buildPrompt={myPromptBuilder} />
```

### Custom AI Endpoint

```typescript
<DragToEditor aiEndpoint="/api/my-custom-ai" />
```

Your endpoint should accept POST requests with `{ prompt: string }` and return a streaming text response compatible with the Vercel AI SDK.

### Custom Styling

```tsx
<DragToEditor
  editorClassName="flex h-full flex-col bg-blue-50"
  dashboardClassName="flex h-full flex-col bg-green-50 p-6"
/>
```

## How It Works

### Drag-and-Drop Flow

```
1. User starts dragging an item
   ↓
2. DndContext captures drag start → stores item data
   ↓
3. DragOverlay shows floating preview card
   ↓
4. Editor drop zone highlights when hovering
   ↓
5. User drops item on editor
   ↓
6. Component builds AI prompt from item data
   ↓
7. AI Extension generates markdown content
   ↓
8. Content appears in editor at cursor
   ↓
9. onMarkdownChange callback fired
```

### Key Technical Details

- **@dnd-kit/core**: Handles all drag-and-drop logic
- **PointerSensor**: 8px activation distance prevents accidental drags
- **BlockNote Editor**: Rich text editing with markdown support
- **AI Extension**: Programmatic AI content generation
- **Dynamic Import**: Editor loaded client-side only (SSR: false)
- **Debouncing**: 500ms debounce on markdown change callbacks

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## Performance Considerations

- Editor uses dynamic import to reduce initial bundle size
- Markdown parsing is async and cancellable
- Change callbacks are debounced (500ms)
- Consider virtualizing item lists for 100+ items

## Troubleshooting

### AI Not Working

1. Verify AI endpoint is correct and accessible
2. Check that endpoint returns compatible streaming response
3. Ensure `@blocknote/xl-ai` is properly installed

### Drag Not Working

1. Verify items have unique `id` properties
2. Check that `@dnd-kit/core` is installed
3. Ensure no conflicting CSS that prevents pointer events

### Editor Not Loading

1. Verify all BlockNote packages are installed
2. Check that component is client-side only (`"use client"`)
3. Ensure Tailwind CSS is configured

## Examples

See `page.tsx` for a complete working example with sample data.

## License

MIT

## Credits

Extracted from the FinalPage component with improvements for reusability and configurability.

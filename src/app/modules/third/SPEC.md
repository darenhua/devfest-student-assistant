# AllList Component Extraction Specification

## Component Overview

**Source:** `/Users/lellyo/Desktop/cool-projects/devfest-school/web/src/app/modules/final/components/AgentDashboard.tsx` (lines 229-256)

**Purpose:** The `AllList` component renders a unified, infinite-scrolling list of heterogeneous items (homework, events, office hours, and exams) with drag-and-drop support and sophisticated hover effects.

**Developer's Question:** "where does this data come from"

### Answer: Data Flow
The data flows as follows:
1. **Server Actions** (`actions.ts`): Four separate server actions fetch data from JSON files on disk:
   - `getHomeworkItems()` - reads from Canvas cache and external findings cache
   - `getEventItems()` - reads from Columbia events JSON
   - `getOfficeHourItems()` - reads from external findings cache
   - `getExamItems()` - reads from external findings cache

2. **Parent Component** (`AgentDashboard`): Calls these actions on mount, stores results in separate state arrays, then transforms them into a unified `AnyItem[]` array:
   ```typescript
   const allItems: AnyItem[] = [
     ...homework.map((item) => ({ kind: "homework" as const, item })),
     ...events.map((item) => ({ kind: "event" as const, item })),
     ...officeHours.map((item) => ({ kind: "office_hour" as const, item })),
     ...exams.map((item) => ({ kind: "exam" as const, item })),
   ];
   ```

3. **AllList Component**: Receives the pre-merged `allItems` array and renders each item using type-specific row components.

## What to Extract

### Core Functionality

1. **Infinite Scroll Pattern**
   - Uses `useInfiniteScroll` custom hook for pagination
   - Starts with 20 items, loads 20 more when sentinel element becomes visible
   - IntersectionObserver-based progressive loading

2. **Heterogeneous Item Rendering**
   - Renders four different item types in a single list
   - Uses discriminated union type (`AnyItem`) to type-safely render correct component
   - Each item type has its own row component (HomeworkRow, EventRow, OfficeHourRow, ExamRow)

3. **Drag-and-Drop Support**
   - All items wrapped in `DraggableItem` component
   - Uses `@dnd-kit/core` library
   - Each item has a unique drag ID and typed data payload

4. **Sophisticated Hover Effects**
   - Group-based opacity transitions (1000ms duration)
   - When any item is hovered, all other items fade to 40% opacity
   - Uses CSS selectors: `pointer-fine:group-has-[a:hover]/list:opacity-40`
   - Instant reset on mouse out (`hover:duration-0`)

### Visual Design

- Container: `div.group/list.px-5.py-4`
- Each row has negative margins (`-mx-2`) and inner padding (`px-2 py-2`) for hover expansion
- Hover background: `bg-gray-50`
- Optional link support: items with `sourceUrl` are clickable anchors that open in new tabs

### Sub-Components Required

#### 1. HomeworkRow
- Wraps `AssignmentCard` in `DraggableItem`
- Drag ID format: `hw-${hw.id}`
- Data: `{ type: "homework", item: hw }`

#### 2. EventRow
- Displays title, timeLabel, location
- Conditional link wrapper based on `sourceUrl`
- Drag ID format: `event-${event.id}`
- Data: `{ type: "event", item: event }`

#### 3. OfficeHourRow
- Displays label, timeInfo, location
- Conditional link wrapper based on `sourceUrl`
- Drag ID format: `oh-${oh.id}`
- Data: `{ type: "office_hour", item: oh }`

#### 4. ExamRow
- Displays title, timeInfo, location
- Conditional link wrapper based on `sourceUrl`
- Drag ID format: `exam-${exam.id}`
- Data: `{ type: "exam", item: exam }`

#### 5. Sentinel
- Empty div with `ref` for IntersectionObserver
- Only renders when `hasMore === true`
- Height: `h-8` (32px)

### Types Required

```typescript
export interface EventItem {
  id: string;
  title: string;
  timeLabel: string;
  location: string;
  sourceUrl: string;
  source: "columbia-events";
}

export interface HomeworkItem {
  id: string;
  title: string;
  className: string;
  dueDate: string;
  sourceUrl: string;
  sourceName: string;
  source: "canvas" | "ext-sources";
}

export interface OfficeHourItem {
  id: string;
  label: string;
  timeInfo: string;
  location: string;
  sourceUrl: string;
  source: "ext-sources";
}

export interface ExamItem {
  id: string;
  title: string;
  timeInfo: string;
  location: string;
  sourceUrl: string;
  source: "ext-sources";
}

export type AnyItem =
  | { kind: "event"; item: EventItem }
  | { kind: "homework"; item: HomeworkItem }
  | { kind: "office_hour"; item: OfficeHourItem }
  | { kind: "exam"; item: ExamItem };

export type DragItemData =
  | { type: "homework"; item: HomeworkItem }
  | { type: "event"; item: EventItem }
  | { type: "office_hour"; item: OfficeHourItem }
  | { type: "exam"; item: ExamItem };
```

## Dependencies to Carry

### NPM Packages
- `@dnd-kit/core` - for drag-and-drop functionality (already installed)
- React hooks: `useState`, `useCallback`, `useRef`, `useEffect`

### Internal Components
1. **AssignmentCard** (`./AssignmentCard.tsx`)
   - Used by HomeworkRow
   - Renders homework item with title, className, dueDate, sourceName
   - Self-contained, no external dependencies

2. **DraggableItem** (`./DraggableItem.tsx`)
   - Wraps all row components
   - Uses `useDraggable` from `@dnd-kit/core`
   - Accepts `id`, `data`, and `children` props

### Custom Hook
**useInfiniteScroll<T>** (lines 28-54 in source)
- Generic hook for paginated rendering
- Parameters: `allItems: T[]`
- Returns: `{ items: T[], hasMore: boolean, sentinelRef: (node: HTMLDivElement | null) => void }`
- Uses IntersectionObserver with 0.1 threshold
- Page size constant: `PAGE_SIZE = 20`

### Styling
- Tailwind CSS v4
- Uses advanced selectors: `group/list`, `pointer-fine:group-has-[...]`
- Custom animations via transition durations

## What to Leave Behind

### App-Specific Context (DO NOT EXTRACT)

1. **Data Fetching Logic**
   - Server actions (`getEventItems`, `getHomeworkItems`, etc.)
   - File system paths to JSON caches
   - Canvas API integration
   - External findings cache parsing

2. **Parent Component State Management**
   - Tab switching logic
   - Agent runner integration
   - Loading states
   - Auto-mode functionality
   - Source modal management

3. **Global App Routing**
   - Next.js app router specifics
   - Page-level layouts

4. **Agent System**
   - `useAgentRunner` hook
   - `AgentView` component
   - `AGENTS_BY_TAB` configuration
   - Agent state management

## Integration Plan

### API Surface (Props)

```typescript
interface AllListProps {
  allItems: AnyItem[];
}
```

**Single Required Prop:**
- `allItems`: Pre-merged array of all item types with discriminated union shape

### Context Requirements

**Drag-and-Drop Context:**
The parent component must wrap `AllList` in a `DndContext` from `@dnd-kit/core`:

```typescript
import { DndContext } from '@dnd-kit/core';

function ParentComponent() {
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <AllList allItems={items} />
    </DndContext>
  );
}
```

**No Other Context Required:**
- No global state subscriptions
- No routing dependencies
- No authentication/authorization

### Data Preparation

The consumer must provide data in this exact shape:

```typescript
const allItems: AnyItem[] = [
  { kind: "homework", item: { id: "1", title: "...", className: "...", dueDate: "...", sourceUrl: "...", sourceName: "...", source: "canvas" } },
  { kind: "event", item: { id: "2", title: "...", timeLabel: "...", location: "...", sourceUrl: "...", source: "columbia-events" } },
  { kind: "office_hour", item: { id: "3", label: "...", timeInfo: "...", location: "...", sourceUrl: "...", source: "ext-sources" } },
  { kind: "exam", item: { id: "4", title: "...", timeInfo: "...", location: "...", sourceUrl: "...", source: "ext-sources" } },
];
```

**Key Point:** The component does NOT fetch data. It's purely presentational and expects pre-fetched, pre-merged data.

### File Structure for Extracted Module

```
src/app/modules/third/
├── SPEC.md (this file)
├── components/
│   ├── AllList.tsx          # Main component
│   ├── HomeworkRow.tsx      # Row component
│   ├── EventRow.tsx         # Row component
│   ├── OfficeHourRow.tsx    # Row component
│   ├── ExamRow.tsx          # Row component
│   ├── Sentinel.tsx         # Infinite scroll sentinel
│   ├── AssignmentCard.tsx   # Copied from source
│   ├── DraggableItem.tsx    # Copied from source
│   └── types.ts             # Type definitions
├── hooks/
│   └── useInfiniteScroll.ts # Custom hook
└── constants.ts             # PAGE_SIZE constant
```

### Setup Steps

1. **Install Dependencies:**
   ```bash
   bun add @dnd-kit/core
   ```

2. **Copy Required Files:**
   - `AssignmentCard.tsx` (no modifications needed)
   - `DraggableItem.tsx` (no modifications needed)
   - Type definitions from `types.ts`

3. **Extract Custom Hook:**
   - Move `useInfiniteScroll` to separate file
   - Export `PAGE_SIZE` constant

4. **Create Row Components:**
   - Extract HomeworkRow, EventRow, OfficeHourRow, ExamRow
   - Keep identical styling and behavior

5. **Create AllList Component:**
   - Single prop: `allItems: AnyItem[]`
   - Use switch statement for type discrimination
   - Maintain infinite scroll pattern

### Usage Example

```typescript
'use client';

import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { AllList } from './components/AllList';
import type { AnyItem } from './components/types';

export function MyPage() {
  const [items, setItems] = useState<AnyItem[]>([]);

  useEffect(() => {
    // Fetch and merge your data from any source
    async function loadData() {
      const homework = await fetchHomework();
      const events = await fetchEvents();
      const officeHours = await fetchOfficeHours();
      const exams = await fetchExams();

      const merged: AnyItem[] = [
        ...homework.map(item => ({ kind: "homework" as const, item })),
        ...events.map(item => ({ kind: "event" as const, item })),
        ...officeHours.map(item => ({ kind: "office_hour" as const, item })),
        ...exams.map(item => ({ kind: "exam" as const, item })),
      ];

      setItems(merged);
    }

    loadData();
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    // Handle drag-and-drop logic
    console.log('Dragged:', event.active.data.current);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <AllList allItems={items} />
    </DndContext>
  );
}
```

### Configuration Options (Future)

The extracted component could be enhanced with optional props:

```typescript
interface AllListProps {
  allItems: AnyItem[];
  pageSize?: number;              // Override default PAGE_SIZE
  onItemClick?: (item: AnyItem) => void;  // Custom click handler
  enableDrag?: boolean;           // Toggle drag-and-drop
  className?: string;             // Custom container styling
}
```

But the initial extraction should keep the API minimal (just `allItems`).

## Testing Considerations

### Data Sources to Mock

1. **Homework Items:**
   - Canvas assignments (source: "canvas")
   - External web findings (source: "ext-sources")

2. **Event Items:**
   - Columbia events (source: "columbia-events")

3. **Office Hour Items:**
   - External web findings (source: "ext-sources")

4. **Exam Items:**
   - External web findings (source: "ext-sources")

### Test Cases

1. **Empty State:** Empty `allItems` array
2. **Single Item Type:** All homework, all events, etc.
3. **Mixed Types:** Realistic mix of all four types
4. **Large Dataset:** 100+ items to test infinite scroll
5. **Items Without sourceUrl:** Ensure no broken links
6. **Drag and Drop:** Verify drag data payload is correct

## Performance Notes

- **Infinite Scroll:** Only renders visible items + buffer (20 at a time)
- **IntersectionObserver:** Efficient scroll detection (0.1 threshold)
- **No Virtualization:** Uses simple pagination, not full virtualization
- **Hover Effects:** CSS-only (no JavaScript overhead)
- **Re-renders:** Component re-renders when `allItems` reference changes

## Open Questions for Consumer

1. **Drag Target:** Where should dragged items be dropped? (Consumer must implement `onDragEnd`)
2. **Item Actions:** Should items be editable/deletable? (Not in current implementation)
3. **Sorting:** Should items be sorted by date/priority? (Consumer must pre-sort `allItems`)
4. **Empty State:** What to show when `allItems` is empty? (Not handled by component)

## Key Differences from Source Context

| Aspect | Source (AgentDashboard) | Extracted (AllList) |
|--------|------------------------|---------------------|
| Data Fetching | Server actions in parent | Consumer-provided prop |
| State Management | Multiple useState for each type | Single prop |
| Loading State | Managed by parent | Not applicable |
| Tabs | 5 tabs with switching logic | Single unified view |
| Agent Integration | Runs agents to fetch data | No agent awareness |
| Modal | Source management modal | Not included |

## Summary

The `AllList` component is a **presentation-only** component that renders a unified, infinite-scrolling, drag-and-drop enabled list of heterogeneous school-related items. It has no opinions about where data comes from—it simply renders whatever `AnyItem[]` array you provide. The consumer is responsible for:

1. Fetching and merging data from any source
2. Wrapping the component in `DndContext`
3. Handling drag-and-drop events
4. Managing loading/error states
5. Implementing empty states

This makes it highly reusable across different contexts (dashboard, calendar integration, search results, etc.).

# AllList Component - Extraction Specification

## Overview

The `AllList` component (lines 229-256 in `AgentDashboard.tsx`) is a unified list renderer that displays heterogeneous item types (homework, events, office hours, exams) in a single scrollable list with infinite scroll support.

## What to Extract

### Core Functionality

**Visual Output:**
- Renders a scrollable list container with `group/list` context for hover effects
- Displays items of different types (homework, events, office hours, exams) in a single unified list
- Each item type is rendered with its specialized row component:
  - `HomeworkRow` - renders homework assignments with title, class, due date
  - `EventRow` - renders events with title, time, location
  - `OfficeHourRow` - renders office hours with label, time info, location
  - `ExamRow` - renders exams with title, time info, location
- Includes a sentinel element at the bottom for infinite scroll triggering

**Interactivity:**
- Infinite scroll: loads more items as user scrolls to bottom
- Each item is wrapped in `DraggableItem` for drag-and-drop support
- Items with `sourceUrl` are clickable links (open in new tab)
- Sophisticated hover effects: siblings fade to 40% opacity when one item is hovered (via `group-has-[]` selector)

**State Management:**
- Uses `useInfiniteScroll` hook to manage pagination:
  - Starts with `PAGE_SIZE` (20) items visible
  - Loads additional batches when sentinel becomes visible
  - Tracks visible count and whether more items exist
- IntersectionObserver-based scroll detection with 0.1 threshold

**Performance:**
- Lazy loading via infinite scroll
- Only renders visible items (up to current `count`)
- Efficient re-rendering through proper React keys

## Dependencies to Carry

### React Hooks & Utilities
```typescript
import { useState, useCallback, useRef } from "react";
```

### Child Components (REQUIRED)
```typescript
import { HomeworkRow } from "./HomeworkRow";      // Lines 157-166
import { EventRow } from "./EventRow";            // Lines 58-89
import { OfficeHourRow } from "./OfficeHourRow";  // Lines 91-122
import { ExamRow } from "./ExamRow";              // Lines 124-155
import { Sentinel } from "./Sentinel";            // Lines 168-177
```

Each row component depends on:
- `DraggableItem` component (wraps content for drag-and-drop)
- `AssignmentCard` component (used by HomeworkRow)

### Custom Hooks (REQUIRED)
```typescript
import { useInfiniteScroll } from "./useInfiniteScroll";  // Lines 28-54
```

The hook signature:
```typescript
function useInfiniteScroll<T>(allItems: T[]): {
  items: T[];
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
}
```

Constants:
```typescript
const PAGE_SIZE = 20;  // Line 26
```

### Type Definitions (REQUIRED)
```typescript
import type { AnyItem } from "./types";
```

Where `AnyItem` is a discriminated union:
```typescript
type AnyItem =
  | { kind: "event"; item: EventItem }
  | { kind: "homework"; item: HomeworkItem }
  | { kind: "office_hour"; item: OfficeHourItem }
  | { kind: "exam"; item: ExamItem };
```

### External Packages
- None directly in `AllList`, but row components use:
  - `@dnd-kit/core` (via `DraggableItem`)

### Styling
- Tailwind CSS v4
- Custom classes:
  - `group/list` - enables named group for hover effects
  - `pointer-fine:group-has-[a:hover]/list:opacity-40` - advanced media query + group selector
  - Padding: `px-5 py-4` on container

## What to Leave Behind

### App-Specific Concerns
1. **Data Fetching Logic** - `AllList` is purely presentational; it receives pre-fetched `allItems`
   - Leave behind: `getEventItems()`, `getHomeworkItems()`, etc. from `../actions`
   - Leave behind: Data aggregation logic that combines arrays (lines 398-403 in AgentDashboard)

2. **Parent Dashboard State** - Tab switching, loading states, agent runners
   - Leave behind: `AgentDashboard` state management
   - Leave behind: `loadData()` callback and its coordination

3. **Global Context** - This component doesn't use any global context/providers (safe to extract)

4. **Routing** - No Next.js routing dependencies

5. **Source URL Generation** - Assumes items already have `sourceUrl` property

## Integration Plan

### Extracted Component API

**Location:** Create new module at:
```
src/app/modules/unified-list/
├── AllList.tsx          (main component)
├── useInfiniteScroll.ts (pagination hook)
├── Sentinel.tsx         (scroll trigger element)
├── rows/
│   ├── HomeworkRow.tsx
│   ├── EventRow.tsx
│   ├── OfficeHourRow.tsx
│   └── ExamRow.tsx
├── DraggableItem.tsx    (copy from final/components)
├── AssignmentCard.tsx   (copy from final/components)
└── types.ts             (type definitions)
```

**Props Interface:**
```typescript
interface AllListProps {
  items: AnyItem[];        // Pre-sorted, pre-filtered array
  pageSize?: number;       // Optional override (default: 20)
  enableDrag?: boolean;    // Optional: disable dragging (default: true)
}
```

**Usage Example:**
```typescript
import { AllList } from "@/modules/unified-list/AllList";
import type { AnyItem } from "@/modules/unified-list/types";

function MyDashboard() {
  const [allItems, setAllItems] = useState<AnyItem[]>([]);

  // Fetch and combine your data
  useEffect(() => {
    const combined = [
      ...homework.map(item => ({ kind: "homework" as const, item })),
      ...events.map(item => ({ kind: "event" as const, item })),
      // etc.
    ];
    setAllItems(combined);
  }, [homework, events]);

  return (
    <div className="h-full">
      <AllList items={allItems} />
    </div>
  );
}
```

### Context Requirements

**DnD Context (for dragging):**
If drag-and-drop is needed, the parent must wrap with:
```typescript
import { DndContext } from "@dnd-kit/core";

<DndContext onDragEnd={handleDragEnd}>
  <AllList items={allItems} />
</DndContext>
```

If drag is not needed, make `DraggableItem` optional/conditional.

### Configuration

**Styling Setup:**
- Requires Tailwind CSS v4
- Requires support for:
  - Named groups (`group/list`)
  - Container queries or `pointer-fine` media query
  - `group-has-[]` variant (Tailwind 3.4+)

**Responsive Behavior:**
- Container must have defined height (component uses `overflow-y-auto`)
- Parent should use flexbox or grid to constrain height

### Data Shape Requirements

Each item in the `AnyItem` array must have:

**EventItem:**
```typescript
{
  kind: "event",
  item: {
    id: string;
    title: string;
    timeLabel: string;
    location: string;
    sourceUrl: string;    // Empty string if no URL
  }
}
```

**HomeworkItem:**
```typescript
{
  kind: "homework",
  item: {
    id: string;
    title: string;
    className: string;
    dueDate: string;
    sourceUrl: string;
    sourceName: string;
  }
}
```

**OfficeHourItem:**
```typescript
{
  kind: "office_hour",
  item: {
    id: string;
    label: string;
    timeInfo: string;
    location: string;
    sourceUrl: string;
  }
}
```

**ExamItem:**
```typescript
{
  kind: "exam",
  item: {
    id: string;
    title: string;
    timeInfo: string;
    location: string;
    sourceUrl: string;
  }
}
```

### Key Constraints

1. **Item IDs must be unique** - Used for React keys in format `{kind}-{item.id}`
2. **Items are rendered in order provided** - Consumer responsible for sorting
3. **No built-in filtering** - Consumer must pre-filter the array
4. **Scroll container** - Parent must have constrained height; component uses `overflow-y-auto`

### Testing Considerations

**Unit Tests:**
- Test infinite scroll triggers correctly
- Test all 4 item types render with correct row component
- Test drag-and-drop data structure
- Test empty state handling

**Integration Tests:**
- Test with large datasets (100+ items)
- Test scroll performance
- Test mixed item types in various orders
- Test with/without `sourceUrl` links

**Accessibility:**
- Each row should be keyboard accessible
- Links should be focusable
- Drag-and-drop should have keyboard alternatives (if enabled)

## Migration Path

1. **Extract dependencies first:**
   - Create `useInfiniteScroll.ts` hook
   - Extract `Sentinel.tsx` component
   - Extract row components with their sub-dependencies

2. **Create unified module:**
   - Set up directory structure
   - Copy/adapt components
   - Update imports to be module-relative

3. **Make drag-and-drop optional:**
   - Add `enableDrag` prop
   - Conditionally wrap with `DraggableItem`
   - Document DndContext requirement

4. **Test in isolation:**
   - Create fixture data
   - Test all item types
   - Verify infinite scroll

5. **Replace original usage:**
   - Update `AgentDashboard.tsx` to import from new module
   - Verify behavior unchanged

## Notes

- The component is currently **tightly coupled** to 4 specific item types via the discriminated union
- Consider making it **generic** in the future:
  ```typescript
  interface UnifiedListProps<T> {
    items: T[];
    renderItem: (item: T) => ReactNode;
    getKey: (item: T) => string;
  }
  ```
- The hover effect (`group-has-[a:hover]/list:opacity-40`) is sophisticated but may not work in all Tailwind setups
- IntersectionObserver has good browser support (IE not supported)
- Current implementation shows no empty state - consumer must handle

# AllList Component - Extracted Module

This module contains the `AllList` component extracted from the AgentDashboard according to the specifications in `SPEC.md`.

## Overview

The `AllList` component is a **presentation-only** component that renders a unified, infinite-scrolling, drag-and-drop enabled list of heterogeneous school-related items (homework, events, office hours, and exams).

## Features

- ✅ **Infinite Scroll**: Progressive loading using IntersectionObserver (20 items at a time)
- ✅ **Heterogeneous Item Rendering**: Supports 4 different item types with type-safe rendering
- ✅ **Drag-and-Drop Support**: All items are draggable using `@dnd-kit/core`
- ✅ **Sophisticated Hover Effects**: Group-based opacity transitions with 1000ms duration
- ✅ **Responsive Design**: Tailwind CSS with advanced selectors

## File Structure

```
src/app/modules/third/
├── SPEC.md                      # Original specification document
├── README.md                    # This file
├── page.tsx                     # Demo implementation
├── constants.ts                 # PAGE_SIZE constant
├── components/
│   ├── index.ts                 # Barrel export for easy imports
│   ├── AllList.tsx              # Main component
│   ├── HomeworkRow.tsx          # Homework item row
│   ├── EventRow.tsx             # Event item row
│   ├── OfficeHourRow.tsx        # Office hour item row
│   ├── ExamRow.tsx              # Exam item row
│   ├── Sentinel.tsx             # Infinite scroll sentinel
│   ├── AssignmentCard.tsx       # Homework card UI
│   ├── DraggableItem.tsx        # Drag wrapper component
│   └── types.ts                 # TypeScript type definitions
└── hooks/
    └── useInfiniteScroll.ts     # Custom infinite scroll hook
```

## Usage

### Basic Usage

```typescript
"use client";

import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { AllList } from "./components/AllList";
import type { AnyItem } from "./components/types";

export default function MyPage() {
  const items: AnyItem[] = [
    {
      kind: "homework",
      item: {
        id: "hw-1",
        title: "Complete Assignment",
        className: "CS 101",
        dueDate: "Feb 20, 2026",
        sourceUrl: "https://example.com",
        sourceName: "Canvas",
        source: "canvas",
      },
    },
    // ... more items
  ];

  function handleDragEnd(event: DragEndEvent) {
    console.log("Dragged:", event.active.data.current);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <AllList allItems={items} />
    </DndContext>
  );
}
```

### With Data Fetching

```typescript
"use client";

import { useState, useEffect } from "react";
import { DndContext } from "@dnd-kit/core";
import { AllList } from "./components/AllList";
import type { AnyItem } from "./components/types";

export default function MyPage() {
  const [items, setItems] = useState<AnyItem[]>([]);

  useEffect(() => {
    async function loadData() {
      const homework = await fetchHomework();
      const events = await fetchEvents();
      const officeHours = await fetchOfficeHours();
      const exams = await fetchExams();

      const merged: AnyItem[] = [
        ...homework.map((item) => ({ kind: "homework" as const, item })),
        ...events.map((item) => ({ kind: "event" as const, item })),
        ...officeHours.map((item) => ({ kind: "office_hour" as const, item })),
        ...exams.map((item) => ({ kind: "exam" as const, item })),
      ];

      setItems(merged);
    }

    loadData();
  }, []);

  return (
    <DndContext onDragEnd={(e) => console.log(e)}>
      <AllList allItems={items} />
    </DndContext>
  );
}
```

## API Reference

### AllList Component

```typescript
interface AllListProps {
  allItems: AnyItem[];
}
```

**Props:**

- `allItems`: Pre-merged array of all item types with discriminated union shape

**Context Requirements:**

- Must be wrapped in `DndContext` from `@dnd-kit/core`

### Types

```typescript
// Discriminated union for all items
type AnyItem =
  | { kind: "homework"; item: HomeworkItem }
  | { kind: "event"; item: EventItem }
  | { kind: "office_hour"; item: OfficeHourItem }
  | { kind: "exam"; item: ExamItem };

// Individual item types
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

### Custom Hook

```typescript
function useInfiniteScroll<T>(allItems: T[]): {
  items: T[];
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
}
```

## Dependencies

### Required Packages

- `@dnd-kit/core` - For drag-and-drop functionality
- `react` - React 18+
- `tailwindcss` - Tailwind CSS v4

### Installation

```bash
npm install @dnd-kit/core
# or
yarn add @dnd-kit/core
# or
bun add @dnd-kit/core
```

## Design Features

### Infinite Scroll

- Starts with 20 items visible
- Loads 20 more when sentinel element becomes visible
- Uses IntersectionObserver with 0.1 threshold
- Efficient for large datasets (100+ items)

### Hover Effects

- Group-based opacity transitions (1000ms duration)
- When any item is hovered, all other items fade to 40% opacity
- Instant reset on mouse out (`hover:duration-0`)
- CSS-only implementation (no JavaScript overhead)

### Drag-and-Drop

- All items are draggable
- Unique drag ID format:
  - Homework: `hw-${id}`
  - Event: `event-${id}`
  - Office Hour: `oh-${id}`
  - Exam: `exam-${id}`
- Typed data payload includes item type and data

## Consumer Responsibilities

The consumer of this component is responsible for:

1. **Data Fetching**: Fetching and merging data from any source
2. **DndContext**: Wrapping the component in `DndContext`
3. **Drag Handling**: Implementing `onDragEnd` handler
4. **Loading States**: Managing loading/error states
5. **Empty States**: Implementing empty state UI
6. **Sorting**: Pre-sorting items in desired order

## Testing

See the demo implementation in `page.tsx` for a working example with mock data.

## Key Differences from Source

| Aspect | Source (AgentDashboard) | Extracted (AllList) |
|--------|------------------------|---------------------|
| Data Fetching | Server actions in parent | Consumer-provided prop |
| State Management | Multiple useState arrays | Single prop |
| Loading State | Managed by parent | Not applicable |
| Tabs | 5 tabs with switching | Single unified view |
| Agent Integration | Runs agents to fetch data | No agent awareness |

## Performance Notes

- **Infinite Scroll**: Only renders visible items + buffer (20 at a time)
- **IntersectionObserver**: Efficient scroll detection (0.1 threshold)
- **No Virtualization**: Uses simple pagination, not full virtualization
- **Hover Effects**: CSS-only (no JavaScript overhead)
- **Re-renders**: Component re-renders when `allItems` reference changes

## Future Enhancements

Potential optional props for future versions:

```typescript
interface AllListProps {
  allItems: AnyItem[];
  pageSize?: number;                        // Override default PAGE_SIZE
  onItemClick?: (item: AnyItem) => void;    // Custom click handler
  enableDrag?: boolean;                     // Toggle drag-and-drop
  className?: string;                       // Custom container styling
}
```

## License

This component is part of the application codebase and follows the same license.

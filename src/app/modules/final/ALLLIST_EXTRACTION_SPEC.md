# AllList Component Extraction Specification

## Component Overview

**Location:** `/src/app/modules/final/components/AgentDashboard.tsx` (lines 229-256)
**Component Name:** `AllList`
**Purpose:** Renders a unified, infinitely-scrollable list of heterogeneous items (homework, events, office hours, exams) with drag-and-drop support and sophisticated hover interactions.

---

## What to Extract

### Core Behavior

The `AllList` component is a **polymorphic list renderer** that:

1. **Accepts heterogeneous data**: Takes an array of `AnyItem` objects, where each item is a discriminated union containing one of four types: `homework`, `event`, `office_hour`, or `exam`.

2. **Implements infinite scroll**: Uses the `useInfiniteScroll` hook to progressively load items in chunks of 20, with an Intersection Observer watching a sentinel element at the bottom.

3. **Renders type-specific rows**: Switches on each item's `kind` field and delegates rendering to specialized row components:
   - `HomeworkRow` → renders homework assignments
   - `EventRow` → renders events
   - `OfficeHourRow` → renders office hours
   - `ExamRow` → renders exams

4. **Supports drag-and-drop**: Each row is wrapped in `DraggableItem` component (from `@dnd-kit/core`), enabling drag operations with type-safe data payloads.

5. **Implements sophisticated hover effects**: Uses Tailwind's `group` and `:has()` pseudo-class to create a "dim-all-except-hovered" effect:
   - Container has `group/list` class
   - All items dim to 40% opacity on any sibling hover
   - Hovered item stays at 100% opacity
   - 1-second transition creates smooth fade effect

### Visual Output

```
┌─────────────────────────────────────┐
│  [Homework Item - draggable]        │  ← AssignmentCard component
│  [Event Item - draggable]           │  ← EventRow component
│  [Office Hour - draggable]          │  ← OfficeHourRow component
│  [Exam Item - draggable]            │  ← ExamRow component
│  [Homework Item - draggable]        │
│  ...                                 │
│  [Sentinel] ← triggers loading more  │
└─────────────────────────────────────┘
```

- **Container**: `px-5 py-4 group/list`
- **Items**: Auto-generated keys like `hw-${id}`, `ev-${id}`, `oh-${id}`, `ex-${id}`
- **Infinite scroll**: Sentinel div (8px height) appears when `hasMore` is true

### State Management

- **Local state**: None (stateless component)
- **Derived state**:
  - `useInfiniteScroll` hook manages:
    - `count` (number of items to show)
    - `items` (sliced visible items)
    - `hasMore` (boolean)
    - `sentinelRef` (callback ref for Intersection Observer)

### Side Effects

- **Intersection Observer**: Created/destroyed by `useInfiniteScroll` hook
  - Watches sentinel element
  - Triggers when 10% visible (threshold: 0.1)
  - Increases count by PAGE_SIZE (20) when triggered
  - Disconnects/reconnects when `allItems.length` changes

---

## Dependencies to Carry

### 1. React Hooks
```typescript
import { useState, useCallback, useRef } from "react";
```

### 2. Custom Hook: `useInfiniteScroll`
**Location:** Same file (`AgentDashboard.tsx`, lines 28-54)
**Must extract this hook as well!**

```typescript
const PAGE_SIZE = 20;

function useInfiniteScroll<T>(allItems: T[]) {
  const [count, setCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setCount((prev) => Math.min(prev + PAGE_SIZE, allItems.length));
          }
        },
        { threshold: 0.1 },
      );
      observerRef.current.observe(node);
    },
    [allItems.length],
  );

  const items = allItems.slice(0, count);
  const hasMore = count < allItems.length;

  return { items, hasMore, sentinelRef };
}
```

### 3. Row Components
**Location:** Same file (`AgentDashboard.tsx`, lines 58-166)
**Must extract these four components:**

- `HomeworkRow` (lines 157-166)
- `EventRow` (lines 58-89)
- `OfficeHourRow` (lines 91-122)
- `ExamRow` (lines 124-155)

All follow identical patterns:
- Accept single prop (e.g., `{ hw: HomeworkItem }`)
- Wrap content in `DraggableItem` with type-prefixed ID
- Conditionally render as `<a>` if `sourceUrl` exists, else `<div>`
- Apply hover effect classes: `-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[...]:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0`

### 4. Sentinel Component
**Location:** Same file (`AgentDashboard.tsx`, lines 168-177)

```typescript
function Sentinel({
  hasMore,
  sentinelRef,
}: {
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
}) {
  if (!hasMore) return null;
  return <div ref={sentinelRef} className="h-8" />;
}
```

### 5. Sub-Components (from other files)

**DraggableItem**
**Location:** `/components/DraggableItem.tsx`
**Dependencies:** `@dnd-kit/core` NPM package

```typescript
import { useDraggable } from "@dnd-kit/core";
import type { DragItemData } from "./types";

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

**AssignmentCard**
**Location:** `/components/AssignmentCard.tsx`

```typescript
import type { HomeworkItem } from "./types";

export function AssignmentCard({ hw }: { hw: HomeworkItem }) {
  return (
    <a
      href={hw.sourceUrl || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="-mx-2 flex items-center justify-between px-2 py-2.5 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#171717]">
          {hw.title}
        </p>
        <p className="text-[11px] text-gray-400">
          {hw.className && <>{hw.className} &middot; </>}
          {hw.dueDate}
        </p>
      </div>
      <span className="ml-3 shrink-0 text-[11px] text-gray-400">
        {hw.sourceName} ↗
      </span>
    </a>
  );
}
```

### 6. Type Definitions
**Location:** `/components/types.ts`
**Required types:**

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

### 7. NPM Dependencies

```json
{
  "@dnd-kit/core": "^6.x" // For drag-and-drop
}
```

### 8. Tailwind CSS Configuration

**Required features:**
- Arbitrary variant support: `pointer-fine:`, `group-has-[]:`
- Group feature: `group/list` naming
- Modern pseudo-class support: `:has()` selector

**Note:** The hover effect relies on advanced Tailwind v3.4+ features:
```css
pointer-fine:group-has-[a:hover]/list:opacity-40
pointer-fine:group-has-[div:hover]/list:opacity-40
```

This translates to:
```css
/* On devices with fine pointer (mouse, trackpad) */
/* When any <a> inside .group\/list is hovered */
/* Set this element's opacity to 40% */
```

---

## What to Leave Behind

### 1. App-Specific Data Fetching

**Do NOT extract:**
- `getEventItems()`, `getHomeworkItems()`, `getOfficeHourItems()`, `getExamItems()` server actions
- Any logic that fetches from `/data/*.json` files or databases
- The `loadData` callback that orchestrates parallel data fetching

**Reason:** The extracted component should be **data-agnostic** and accept pre-fetched data as props.

### 2. Parent Component Context

**Do NOT extract:**
- `AgentDashboard` component (parent)
- Tab state management (`useState<TabKey>`, `setTab`)
- Loading state (`setLoading`, loading spinner)
- Agent runner integration (`useAgentRunner`, `runAgent`, etc.)
- Auto-mode toggle
- Source management modal

**Reason:** These are orchestration concerns of the parent dashboard, not the list itself.

### 3. Styling Assumptions

**Do NOT hardcode:**
- Container overflow behavior (parent handles `overflow-y-auto`)
- Height constraints (parent manages `h-full`, `flex-1`, `min-h-0`)

**Reason:** The extracted component should fit into various layout contexts.

---

## Integration Plan

### Proposed API Surface

```typescript
interface AllListProps {
  items: AnyItem[];
  className?: string;
}

export function AllList({ items, className = "" }: AllListProps) {
  // ... implementation
}
```

### Context Requirements

**DnD Context Provider:**
The extracted component requires a `<DndContext>` ancestor from `@dnd-kit/core`:

```typescript
import { DndContext } from "@dnd-kit/core";

function ParentComponent() {
  return (
    <DndContext onDragEnd={handleDragEnd}>
      <AllList items={myItems} />
    </DndContext>
  );
}
```

**Why:** `DraggableItem` uses `useDraggable()` which requires context.

### Styling Requirements

1. **Tailwind CSS v3.4+** with these features enabled:
   - `@tailwindcss/typography` (optional, for prose styling)
   - Group variants: `group`, `group-has`
   - Pointer variants: `pointer-fine`

2. **Global styles** for animations (already standard in Tailwind):
   ```css
   @keyframes ping { ... }
   @keyframes pulse { ... }
   ```

3. **Container must allow scrolling** if items exceed viewport:
   ```tsx
   <div className="overflow-y-auto">
     <AllList items={data} />
   </div>
   ```

### Usage Example

```typescript
import { AllList } from "./components/AllList";
import type { AnyItem } from "./components/types";

function MyDashboard() {
  const [allItems, setAllItems] = useState<AnyItem[]>([]);

  useEffect(() => {
    // Fetch your data however you want
    fetchMyData().then(setAllItems);
  }, []);

  return (
    <DndContext onDragEnd={(event) => console.log("Dragged:", event)}>
      <div className="h-screen overflow-y-auto">
        <AllList items={allItems} />
      </div>
    </DndContext>
  );
}
```

### File Structure for Extraction

```
extracted-module/
├── components/
│   ├── AllList.tsx          ← Main component
│   ├── AssignmentCard.tsx   ← Homework renderer
│   ├── DraggableItem.tsx    ← DnD wrapper
│   ├── Sentinel.tsx         ← Scroll trigger
│   ├── types.ts             ← Type definitions
│   └── hooks/
│       └── useInfiniteScroll.ts  ← Scroll logic
├── index.ts                 ← Public exports
├── package.json
└── README.md
```

**Public exports:**
```typescript
export { AllList } from "./components/AllList";
export type {
  AllListProps,
  AnyItem,
  EventItem,
  HomeworkItem,
  OfficeHourItem,
  ExamItem
} from "./components/types";
```

---

## Configuration Options

### Customization Points

1. **Page size**: Currently hardcoded to 20. Consider making configurable:
   ```typescript
   interface AllListProps {
     items: AnyItem[];
     pageSize?: number; // Default: 20
   }
   ```

2. **Intersection observer threshold**: Currently 0.1. Could be configurable:
   ```typescript
   scrollThreshold?: number; // Default: 0.1
   ```

3. **Custom row renderers**: Allow consumers to override default row components:
   ```typescript
   interface AllListProps {
     items: AnyItem[];
     renderHomework?: (hw: HomeworkItem) => React.ReactNode;
     renderEvent?: (event: EventItem) => React.ReactNode;
     // ... etc
   }
   ```

4. **Empty state**: Add support for empty list messaging:
   ```typescript
   emptyMessage?: string | React.ReactNode;
   ```

---

## Testing Considerations

### Unit Tests

1. **Infinite scroll behavior:**
   - Renders initial PAGE_SIZE items
   - Loads more when sentinel enters viewport
   - Stops at total item count

2. **Polymorphic rendering:**
   - Correctly switches on `kind` field
   - Renders appropriate row component for each type
   - Generates unique keys

3. **Drag-and-drop:**
   - Items are draggable
   - Correct data payload attached to each item

### Integration Tests

1. **With DndContext:**
   - Drag events fire correctly
   - Data payload matches item type

2. **Scroll container:**
   - Works in various container heights
   - Sentinel triggers at correct position

### Visual Regression Tests

1. Hover states (opacity transitions)
2. Responsive layout (mobile vs. desktop)
3. Empty state rendering

---

## Performance Considerations

1. **Virtualization**: Current implementation loads all items into DOM (hidden by CSS). For lists >500 items, consider replacing with `react-window` or `@tanstack/react-virtual`.

2. **Memoization**: If parent re-renders frequently, wrap row components in `React.memo()`:
   ```typescript
   const HomeworkRow = React.memo(({ hw }) => { ... });
   ```

3. **Key stability**: Current keys use item IDs, which is correct. Do NOT use array indices.

---

## Migration Path

### Step 1: Create Extraction Module
1. Create new directory: `/extracted/all-list/`
2. Copy dependencies in order:
   - `types.ts`
   - `useInfiniteScroll.ts`
   - `Sentinel.tsx`
   - `DraggableItem.tsx`
   - `AssignmentCard.tsx`
   - Row components (`HomeworkRow`, etc.)
   - `AllList.tsx`

### Step 2: Update Imports
1. Change all relative imports to use new paths
2. Ensure `@dnd-kit/core` is installed

### Step 3: Remove Coupling
1. Remove any references to `../actions`
2. Remove app-specific constants
3. Make configurable what was hardcoded

### Step 4: Test in Isolation
1. Create Storybook stories or test harness
2. Verify drag-and-drop works
3. Verify infinite scroll works
4. Verify all item types render

### Step 5: Document
1. Add JSDoc comments to all exports
2. Create README with usage examples
3. Add TypeScript examples

### Step 6: Consume in Original App
1. Install extracted module (as local package or publish to npm)
2. Replace `<AllList>` usage in `AgentDashboard.tsx`
3. Verify behavior unchanged

---

## Open Questions

1. **Should the component handle loading states?**
   Currently relies on parent to show "Loading..." before mounting. Consider adding:
   ```typescript
   isLoading?: boolean;
   loadingMessage?: string;
   ```

2. **Should it support filtering/sorting?**
   Currently displays items in order received. Consider:
   ```typescript
   sortBy?: (a: AnyItem, b: AnyItem) => number;
   filterBy?: (item: AnyItem) => boolean;
   ```

3. **Should it expose scroll position?**
   For "scroll to top" buttons or persistence:
   ```typescript
   onScrollChange?: (position: number) => void;
   initialScrollPosition?: number;
   ```

4. **Should drag-and-drop be optional?**
   Some consumers may not need DnD:
   ```typescript
   enableDrag?: boolean; // Default: true
   ```

---

## Success Criteria

✅ **Extraction is successful if:**

1. Component renders identical output in new module
2. All four item types display correctly
3. Infinite scroll triggers at same threshold
4. Drag-and-drop works with same payload structure
5. Hover effects match original (dim-all-except-hovered)
6. No runtime errors
7. No TypeScript errors
8. Component works without original `AgentDashboard` context
9. Tests cover all item types and scroll behavior
10. Documentation allows new consumer to integrate in <10 minutes

---

## Additional Notes

- **Browser compatibility**: Intersection Observer is supported in all modern browsers (Chrome 58+, Safari 12.1+, Firefox 55+). For older browsers, include `intersection-observer` polyfill.

- **Accessibility**: Consider adding:
  - `aria-label` to draggable items
  - Keyboard navigation for drag-and-drop (requires `@dnd-kit/sortable`)
  - Focus management for infinite scroll

- **Dark mode**: Current colors are hardcoded (e.g., `text-gray-900`, `bg-gray-50`). Consider:
  ```css
  dark:text-white dark:bg-gray-800
  ```

- **RTL support**: Hover transitions and spacing assume LTR. Test with `dir="rtl"`.

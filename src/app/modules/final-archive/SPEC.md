# AssignmentCard Component - Extraction Specification

## Overview

`AssignmentCard` is a presentational component that displays a single homework/assignment item as a clickable card. It renders title, metadata (class name, due date), and source information with sophisticated hover effects optimized for pointer-fine devices.

## Component Location

- **File:** `components/AssignmentCard.tsx`
- **Lines:** 3-25
- **Type:** Pure functional component (presentational, no state/side-effects)

---

## Data Source Analysis

### Current Data Flow

The `AssignmentCard` component receives data through the following chain:

1. **Server Actions** (`actions.ts`):
   - `getHomeworkItems()` fetches data from two sources:
     - **Canvas LMS**: Reads from `canvas_cache.json` (assignments + course metadata)
     - **External Sources**: Reads from `findings_cache.json` (agent-scraped data)

2. **Data Transformation**:
   - Canvas assignments are transformed into `HomeworkItem` objects with course names resolved from course metadata
   - External findings are filtered by `type === "homework"` and mapped to `HomeworkItem` format
   - Each item gets a unique ID, title, class name, due date, source URL, and source name

3. **Component Hierarchy**:
   ```
   AgentDashboard (fetches data via getHomeworkItems())
     └─> HomeworkList (receives HomeworkItem[])
         └─> HomeworkRow (wraps with DraggableItem)
             └─> AssignmentCard (receives single HomeworkItem)
   ```

### Data Shape

```typescript
interface HomeworkItem {
  id: string;              // "canvas-123" or "ext-hw-0-assignment-name"
  title: string;           // Assignment name
  className: string;       // Course name (from Canvas) or empty (from web)
  dueDate: string;         // Formatted date string or "No due date"
  sourceUrl: string;       // Link to assignment page
  sourceName: string;      // "Canvas" or "Web"
  source: "canvas" | "ext-sources";  // Source discriminator
}
```

**Data Sources:**
- **Canvas**: `src/app/prototypes/testin-canvas/server/canvas_cache.json`
- **External**: `src/app/prototypes/testin-ext-sources/server/findings_cache.json`

---

## What to Extract

### Core Behavior

The `AssignmentCard` component is a **pure presentational component** with:

1. **Visual Structure**:
   - An `<a>` tag wrapping the entire card
   - Two-column layout: content (left) + source badge (right)
   - Title (truncated, 14px, medium weight, #171717)
   - Metadata line (11px, gray-400): `{className} · {dueDate}`
   - Source badge (11px, gray-400, right-aligned): `{sourceName} ↗`

2. **Interactive Behavior**:
   - External link (opens in new tab via `target="_blank"`)
   - Hover state: background changes to gray-50
   - List context hover effect: reduces opacity to 40% when other items are hovered (via `group-has-[a:hover]/list`)
   - Transition: 1000ms duration normally, 0ms on hover (instant feedback)

3. **Responsive Design**:
   - `pointer-fine:` prefix for opacity reduction (only on devices with precise pointers)
   - Truncation on title to prevent overflow
   - Flexible layout with `min-w-0` for proper text truncation

4. **Accessibility**:
   - Semantic `<a>` tag for link
   - `rel="noopener noreferrer"` security attributes
   - Conditional rendering: `sourceUrl || undefined` (undefined prevents empty href)

---

## Dependencies to Carry

### Type Definitions

```typescript
// Required type from types.ts
interface HomeworkItem {
  id: string;
  title: string;
  className: string;
  dueDate: string;
  sourceUrl: string;
  sourceName: string;
  source: "canvas" | "ext-sources";
}
```

### External Dependencies

- **React**: None beyond basic JSX (no hooks, no state)
- **Styling**: Tailwind CSS classes (requires Tailwind v4 in consuming project)
- **Icons/Assets**: None (uses Unicode ↗ character)

### Tailwind Classes Used

The component relies on these Tailwind utilities:
- Layout: `flex`, `items-center`, `justify-between`, `min-w-0`, `ml-3`, `shrink-0`
- Spacing: `-mx-2`, `px-2`, `py-2.5`
- Typography: `text-sm`, `text-[11px]`, `font-medium`, `truncate`
- Colors: `text-[#171717]`, `text-gray-400`, `bg-gray-50`
- Transitions: `transition`, `duration-1000`, `duration-0`
- Pseudo-classes: `hover:`, `pointer-fine:`
- Group modifiers: `group-has-[a:hover]/list:opacity-40`, `hover:!opacity-100`

**Important**: The `pointer-fine:` variant and `group-has-[]` syntax require Tailwind CSS v4+ or appropriate plugin configuration.

---

## What to Leave Behind

### App-Specific Context

1. **Data Fetching Logic**:
   - Do NOT include `getHomeworkItems()` or any server action logic
   - Do NOT include file system operations (Canvas cache, findings cache)
   - The extracted component should accept pre-fetched data as props

2. **Parent Component Dependencies**:
   - Do NOT include `DraggableItem` wrapper (drag-and-drop is parent responsibility)
   - Do NOT include `HomeworkList` or `AgentDashboard` components
   - Do NOT include infinite scroll logic (that's list-level behavior)

3. **Global State/Context**:
   - No Redux/Zustand/Context providers needed
   - Component is fully controlled by props

4. **Routing/Navigation**:
   - Uses standard `<a>` tag (works with any framework)
   - No Next.js-specific routing (e.g., no `next/link`)

5. **Business Logic**:
   - No validation of data (assumes valid `HomeworkItem`)
   - No error boundaries
   - No loading states (parent handles this)

6. **Legacy Types**:
   - Only extract `HomeworkItem` type
   - Leave behind `Assignment`, `Agent`, `Briefing`, etc. from `types.ts`

---

## Integration Plan

### Component API

```typescript
export function AssignmentCard({ hw }: { hw: HomeworkItem }) {
  // Implementation
}
```

**Props:**
- `hw` (required): `HomeworkItem` object containing all display data

**Return Value:**
- Single `<a>` element (card wrapper)

### Usage Example

```tsx
import { AssignmentCard } from './AssignmentCard';
import type { HomeworkItem } from './types';

// In your component
const assignment: HomeworkItem = {
  id: 'hw-1',
  title: 'Problem Set 3',
  className: 'Intro to Computer Science',
  dueDate: '2/20/2026',
  sourceUrl: 'https://canvas.edu/courses/123/assignments/456',
  sourceName: 'Canvas',
  source: 'canvas'
};

<AssignmentCard hw={assignment} />
```

### Context Requirements

1. **Tailwind CSS Configuration**:
   - Consumer project must have Tailwind CSS v4+ configured
   - Ensure `pointer-fine:` variant is enabled (default in v4)
   - If using v3, may need to add `group-has` plugin or polyfill

2. **List Context (Optional)**:
   - For full hover effects, wrap cards in a parent with `group/list` class
   - Example: `<div className="group/list">...</div>`

3. **Font Loading**:
   - Component uses system fonts via Tailwind defaults
   - No custom font loading required

### Setup & Installation

**Minimal Setup:**
```bash
# If creating standalone module
npm install react tailwindcss
```

**File Structure:**
```
your-module/
├── AssignmentCard.tsx
├── types.ts
└── README.md (optional)
```

### Styling Customization

To customize colors/spacing without editing component:

```tsx
// Wrap in custom container
<div className="[&_a]:hover:bg-blue-50 [&_p]:text-lg">
  <AssignmentCard hw={hw} />
</div>
```

Or extend via Tailwind config:
```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      'assignment-hover': '#f9fafb', // Override gray-50
    }
  }
}
```

---

## Edge Cases & Considerations

### Missing Data Handling

Current implementation gracefully handles:
- **No `sourceUrl`**: Renders with `href={undefined}` (no link but still styled)
- **Empty `className`**: Hides class name + separator (just shows due date)
- **Missing fields**: Assumes parent validates data shape

### Browser Compatibility

- `pointer-fine:` media query requires modern browsers (2021+)
- `group-has` requires Tailwind v4 or polyfill
- Falls back gracefully: opacity effects simply won't apply on older setups

### Performance

- **Pure component**: No side effects, safe for frequent re-renders
- **Memo candidate**: Wrap in `React.memo()` if rendering hundreds of cards
- **List virtualization**: Consider if rendering >100 items (use `react-window`)

---

## Testing Strategy

### Unit Tests

```tsx
import { render, screen } from '@testing-library/react';
import { AssignmentCard } from './AssignmentCard';

test('renders assignment title and metadata', () => {
  const hw = {
    id: '1',
    title: 'Test Assignment',
    className: 'Test Class',
    dueDate: '12/31/2025',
    sourceUrl: 'https://example.com',
    sourceName: 'Canvas',
    source: 'canvas' as const
  };

  render(<AssignmentCard hw={hw} />);

  expect(screen.getByText('Test Assignment')).toBeInTheDocument();
  expect(screen.getByText(/Test Class/)).toBeInTheDocument();
  expect(screen.getByText(/12\/31\/2025/)).toBeInTheDocument();
  expect(screen.getByText(/Canvas/)).toBeInTheDocument();
});

test('opens link in new tab', () => {
  const hw = { /* ... */ };
  render(<AssignmentCard hw={hw} />);

  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});
```

### Visual Regression Tests

- Test hover states (Storybook + Chromatic)
- Test truncation behavior with long titles
- Test layout with/without className

---

## Migration Checklist

When extracting to a new module:

- [ ] Copy `AssignmentCard.tsx` to new module
- [ ] Copy `HomeworkItem` type definition to `types.ts`
- [ ] Verify Tailwind CSS v4+ is installed
- [ ] Test hover effects in list context
- [ ] Add unit tests for edge cases
- [ ] Document any custom styling overrides
- [ ] Update imports in consuming components
- [ ] Remove old component from `final-archive` module (if fully migrated)

---

## Design Rationale

### Why the group hover effect?

The `pointer-fine:group-has-[a:hover]/list:opacity-40` creates a "focus dimming" effect where hovering one card dims others, helping users focus. This is mouse-only to avoid weird behavior on touch devices.

### Why negative margin?

The `-mx-2` allows the hover background to extend to the list edges despite parent padding, creating a full-width hover target.

### Why 1000ms transition?

The long transition creates a smooth dimming effect when hovering off. The `hover:duration-0` removes delay when hovering on for instant feedback.

---

## Future Enhancements (Out of Scope)

Potential improvements for the new module (NOT in current implementation):

1. **Configurable color scheme**: Accept theme colors via props
2. **Status indicators**: Show badges for overdue/completed assignments
3. **Action buttons**: Quick actions (mark done, snooze)
4. **Accessibility**: ARIA labels for screen readers
5. **Animation**: Framer Motion for enter/exit transitions
6. **Dark mode**: Tailwind dark mode variants

These should be added based on new module requirements, not extracted from current version.

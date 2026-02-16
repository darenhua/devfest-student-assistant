# SPEC: Comment Overlay — React Grab Integration & Overlay Rendering

**Source of truth:** `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx`, `staging/web/src/app/comment-overlay/CommentOverlay.tsx`
**Approved by:** Human developer (prototype review)
**Scope:** How the comment overlay hooks into react-grab, how pressing "x" toggles an overlay that reads comments from sessionStorage, resolves them to live DOM elements, and renders interactive highlights over those elements.
**Domain:** Behavior / Integration

---

## 1. Requirement (WHAT)

There's an external tool called **react-grab** that lives on `window.__REACT_GRAB__`. It lets developers select React components in the browser and annotate them with comments. react-grab stores everything it captures in `sessionStorage` under the key `"react-grab-recent-items"` — an array of history items, each with an `id`, the element's `tagName`, its React `componentName`, a `content` string (an HTML snippet with source location metadata), and optionally `isComment: true` with `commentText`.

The problem this system solves: sessionStorage holds *serialized descriptions* of elements, not references to actual DOM nodes. To draw an overlay on top of a commented element, you need the real `Element`. This system bridges that gap in two ways:

**At capture time** — a plugin registered on react-grab intercepts `onCopySuccess`, which hands you the actual DOM `Element` the user just selected. The system stashes that element in a module-level `Map` keyed by the sessionStorage item's `id`. That's the fast path — you already have the element, no searching needed.

**After a page reload** — the `Map` is gone. Now the system has to *find* the element again using clues from the serialized `content` string. It parses out the React source file path and line number (e.g. `"  in MyButton (at src/components/Button.tsx:42)"`) and asks react-grab's `getSource()` API to check each candidate element. If that gives a unique match, done. If multiple elements share the same source line (think a `.map()` loop rendering the same component), it falls back to scoring candidates by their HTML attributes, CSS classes, and text content against what was captured.

Once elements are resolved, the developer presses **"x"** (not in an input field, not while react-grab's prompt is open) and an overlay appears. Pink translucent bounding boxes highlight every element that has comments. Pill badges along the top edge of each box show the comment text. If there are too many comments on one element, they collapse into a count badge. Clicking a badge opens an edit modal. Comments that couldn't be matched to any live DOM element show up as "orphans" in the top-left corner — they're not silently lost.

Everything writes back to sessionStorage. Edit a comment, it updates sessionStorage. Delete a comment, it's removed from sessionStorage. The overlay re-reads on every change.

### What the human approved (behavioral observation)

- You press "x" and the overlay appears — every commented element gets a pink highlight with badges. Press "x" again, it's gone.
- When you use react-grab to add a comment to an element, the overlay immediately knows which element that comment belongs to — no page reload needed, no manual refresh.
- After a full page reload, the overlay still finds the right elements and draws the highlights in the same places. The react-grab `getSource()` integration makes this work even for elements that don't have unique IDs or classes.
- The "x" key doesn't accidentally fire when you're typing in a text field or when react-grab's own UI is open.
- Orphan comments (whose elements were removed or can't be found) collect in the top-left corner rather than vanishing.
- Clicking a badge opens an edit modal; changes persist to sessionStorage and survive reload.
- The highlights track their elements in real time as you scroll or resize — they don't lag or drift.

---

## 2. Specification (HOW)

### 2.1 Module-Level React-Grab Plugin Registration

This is the core integration point. It runs **at module evaluation time** — not inside a React component, not inside a `useEffect`. This is load-bearing: the plugin must be active before the user interacts with react-grab.

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L12-L58`

**What it does:** Registers a plugin called `"comment-overlay-tracker"` on `window.__REACT_GRAB__` with a single hook — `onCopySuccess`. When react-grab finishes a copy/comment operation, it calls this hook with the selected DOM `Element[]`. The hook then:

1. Waits 50ms (react-grab writes to sessionStorage asynchronously — reading immediately gets stale data)
2. Reads `sessionStorage` key `"react-grab-recent-items"` and grabs `items[0]` (the just-created item)
3. Stores `items[0].id → element` in the module-level `ELEMENT_MAP`
4. Dispatches a `"comment-overlay-update"` custom event on `window` to tell the React tree that new data is available

**Race condition handling:** The module checks for `window.__REACT_GRAB__` immediately at evaluation time. It *also* listens for a `"react-grab:init"` custom event, covering the case where react-grab loads after this module. The `rg._commentTrackerDone` flag prevents double-registration.

**Why module-level:** `ELEMENT_MAP` is a `Map<string, Element>` declared at the top of the module (line 19), outside any component. It survives React re-renders, unmounts, and remounts. It's shared across all consumers. If you put it in React state or a ref, you'd lose entries when the provider unmounts.

### 2.2 Element Rehydration (Finding Elements After Reload)

After a page reload, `ELEMENT_MAP` is empty. `rehydrateElementMap()` iterates every comment item in sessionStorage and tries to find its DOM element using a two-strategy pipeline.

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L272-L292` (orchestrator)
📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L184-L266` (finder)

**The pipeline for each item:**

1. **Build a candidate set.** Query all elements matching `item.tagName`, then filter to those where `rg.getDisplayName(el) === componentName`. This narrows from "all divs on the page" to "all divs rendered by the MyButton component."

2. **Strategy 1 — Source file + line number** (lines 206-252). Parse the source location from the item's `content` string (e.g. `src/components/Button.tsx:42`). For each candidate, call `rg.getSource(el)` and compare file paths (suffix match — either path ending with the other) and line numbers (exact match). If exactly one element matches, return it. If multiple match (same source line, like a loop), disambiguate with attribute/text scoring on just those candidates.

3. **Strategy 2 — Attribute + text scoring** (lines 254-265). Fallback when source info is unavailable or didn't produce a match. Score every candidate.

**Skipping already-resolved elements:** If `ELEMENT_MAP` already has an entry for an item and that element is still `.isConnected`, rehydration skips it (line 284-285).

### 2.3 Content Parsing (Extracting Match Signals from Stored Strings)

The `content` field in each sessionStorage item is a multi-line string that react-grab wrote. For comment items, `content` is structured as `commentText + "\n\n" + htmlSnippet`. The parser extracts everything needed for element matching.

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L65-L136`

**What it extracts:**

| Signal | How it's parsed | Example |
|--------|----------------|---------|
| Source file + line | Regex on `"  in Component (at file:line)"` trailer | `{ filePath: "src/Button.tsx", lineNumber: 42 }` |
| HTML attributes | Regex on opening tag in snippet | `Map { "id" → "main-btn", "data-testid" → "submit" }` |
| CSS class tokens | Split the `class`/`className` attribute value on whitespace | `["flex", "items-center", "gap-2"]` |
| Truncation awareness | Checks if class value or attribute value ends with `"..."` | Last token uses prefix match instead of exact |
| Inner text | Lines between opening and closing tags, excluding child elements | `"Submit Order"` |

### 2.4 Element Scoring Algorithm

Scores a single DOM element against parsed content. Returns -1 (hard reject) or a positive score.

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L142-L182`

| Signal | Score | Hard fail? |
|--------|-------|------------|
| `id` or `data-testid` attribute matches | +50 per match | No (just skipped if absent) |
| Other attribute matches (aria-label, etc.) | +10 per match | No |
| Each CSS class token present on element | +3 per token | **Yes** — any missing non-truncated token → return -1 |
| Truncated last class token | Prefix match instead of exact | Same hard-fail rule |
| Inner text found in `el.textContent` | +5 base + `100 / (textLength + 1)` | **Yes** — missing text → return -1 |

The `100 / (textLength + 1)` bonus prefers the *smallest* element containing the text. A `<span>Submit</span>` scores higher than the `<form>` that also contains "Submit" in its textContent.

### 2.5 "x" Hotkey & Visibility Toggle

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L371-L388`

A global `keydown` listener on `window`. The "x" key toggles `isVisible` state in the provider, with three suppression rules:

1. `e.target` is `INPUT`, `TEXTAREA`, or `contentEditable` → ignore
2. `window.__REACT_GRAB__.getState().isPromptMode` is truthy → ignore
3. Otherwise → `setIsVisible(v => !v)`

**What happens on toggle-on:** A `useEffect` watching `[isVisible, version, buildTrackedElements]` fires `buildTrackedElements()`, which re-runs rehydration, reads sessionStorage, partitions items into tracked (has live DOM element via `ELEMENT_MAP`) vs orphan (no element or element disconnected), and sets the `trackedElements` and `orphanComments` state.

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L390-L447`

**What happens on toggle-off:** The same effect clears `trackedElements` and `orphanComments` to empty arrays. `ELEMENT_MAP` is NOT cleared — it persists so the next toggle-on doesn't need to re-find everything.

### 2.6 Version-Based Reactivity

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L357-L369`

A `version` state counter drives re-scanning. It's bumped by four events:

1. Initial rehydration completes (line 361)
2. The react-grab plugin captures a new element at runtime — dispatches `"comment-overlay-update"` event (line 43), which the provider listens for (line 366)
3. `updateComment` writes to sessionStorage (line 461)
4. `deleteComment` writes to sessionStorage (line 475)

The `buildTrackedElements` effect depends on `version`, so any bump re-partitions sessionStorage items into tracked/orphan while the overlay is visible.

### 2.7 Overlay Rendering via Portal + rAF Position Loop

📎 `staging/web/src/app/comment-overlay/CommentOverlay.tsx#L51-L107`

The `CommentOverlay` component renders everything into a **`createPortal` on `document.body`**. It waits one tick after mount (`mounted` state) before starting.

**Position tracking:** A `requestAnimationFrame` loop (not scroll/resize listeners) runs continuously while the overlay is visible. Each frame, it reads `getBoundingClientRect()` from every tracked element, filters out zero-size elements, merges overlapping rects, and sets the `positions` state.

📎 `staging/web/src/app/comment-overlay/CommentOverlay.tsx#L64-L80`

**Why rAF, not events:** The rAF loop catches scroll, resize, layout shifts, CSS animations, and programmatic DOM changes — all without registering separate listeners. It's the simplest approach that handles all cases.

**Merging overlapping rects:** If two tracked elements have bounding rects within 3px of each other on all four sides (left, top, width, height), they're merged into a single overlay with combined comments. This prevents stacked duplicate highlights when multiple comment items resolve to visually identical elements.

📎 `staging/web/src/app/comment-overlay/CommentOverlay.tsx#L21-L49`

### 2.8 Per-Element Highlight Rendering

📎 `staging/web/src/app/comment-overlay/CommentOverlay.tsx#L199-L260`

Each tracked element renders as two pieces:

1. **Bounding box** — a fixed-position div matching `getBoundingClientRect()` of the tracked element. Pink translucent border and background, `pointer-events: none`.
2. **Badge row** — positioned `BADGE_HEIGHT (20) + 4` pixels above the bounding box top. `pointer-events: auto` (clickable).

**Badge collapse rule:**

| Comment count | Rendering |
|---------------|-----------|
| 1-3 | One `PillBadge` per comment, text truncated to 20 chars |
| 4+ | Single `PillBadge` reading `"N comments"`, opens list modal on click |

### 2.9 Orphan Comments

📎 `staging/web/src/app/comment-overlay/CommentOverlay.tsx#L131-L170`

Comments whose DOM elements couldn't be found (or whose elements were removed from the DOM since capture) render as a vertical stack in the **top-left corner** of the viewport (`top: 8, left: 8`). Each shows `componentName: commentText` and is clickable — opens the edit modal directly.

### 2.10 SessionStorage Mutation (Update & Delete)

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L449-L479`

**Update:** Finds the item by `id` in the sessionStorage array, sets `item.commentText = newText`, then reconstructs `item.content` by splitting on `"\n\n"`, replacing `parts[0]` with the new text, and re-joining. Writes back the full array. Bumps `version`.

**Delete:** Filters the item out by `id`, writes back the reduced array. Bumps `version`.

Both are wrapped in try/catch with silent failure — sessionStorage errors don't crash the overlay.

### 2.11 SessionStorage Data Shape

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L296-L323`

The overlay reads/writes `sessionStorage` key `"react-grab-recent-items"`. This is **react-grab's key** — the overlay piggybacks on it. The data is a JSON array of:

```typescript
interface HistoryItem {
  id: string;              // Unique ID assigned by react-grab
  content: string;         // commentText + "\n\n" + HTML snippet + source context
  elementName: string;     // Display name (e.g. "div", "button")
  tagName: string;         // Actual HTML tag for querySelectorAll
  componentName?: string;  // React component name (e.g. "MyButton")
  isComment: boolean;      // true = comment entry, false = plain copy
  commentText?: string;    // The comment text
  timestamp: number;       // Unix ms
}
```

The overlay only processes items where `isComment === true && commentText` is truthy.

### 2.12 Context API Shape

📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L327-L345`

```typescript
interface CommentOverlayContextType {
  isVisible: boolean;
  toggle: () => void;
  trackedElements: TrackedElement[];   // { element: Element, comments: CommentEntry[], componentName: string }
  orphanComments: OrphanComment[];     // CommentEntry & { tagName: string }
  updateComment: (id: string, newText: string) => void;
  deleteComment: (id: string) => void;
}
```

Accessed via `useCommentOverlay()` hook, which throws if called outside the provider.

---

## 3. Structure

### 3.1 Data Flow

```
                        ┌─────────────────────────┐
                        │     react-grab           │
                        │  window.__REACT_GRAB__   │
                        └────────┬────────────────┘
                                 │ onCopySuccess(elements)
                                 ▼
               ┌─────────────────────────────────────┐
               │  Plugin (module-level registration)  │
               │  setTimeout(50ms) →                  │
               │    read sessionStorage items[0].id   │
               │    ELEMENT_MAP.set(id, element)      │
               │    dispatch("comment-overlay-update")│
               └────────┬────────────────────────────┘
                        │
         ┌──────────────┼──────────────────────┐
         │              │                      │
         ▼              ▼                      ▼
   ELEMENT_MAP    sessionStorage        Provider state
   (module-level   "react-grab-          version++
    Map<id,        recent-items"         triggers
    Element>)                            buildTrackedElements()
         │              │                      │
         └──────────────┼──────────────────────┘
                        │
                        ▼
              buildTrackedElements()
              ┌──────────────────────────────────────┐
              │ 1. rehydrateElementMap()              │
              │    (fills ELEMENT_MAP for items       │
              │     missing a live element)           │
              │ 2. Read all comment items from        │
              │    sessionStorage                     │
              │ 3. For each: check ELEMENT_MAP        │
              │    ├── found & connected → tracked    │
              │    └── missing/disconnected → orphan  │
              └──────────────┬───────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
         trackedElements           orphanComments
                │                         │
                ▼                         ▼
         CommentOverlay (portal on document.body)
         ├── rAF loop: getBoundingClientRect() per element
         ├── mergeOverlapping()
         ├── ElementOverlay per position (box + badges)
         ├── Orphan pills in top-left corner
         ├── CommentListModal (when collapsed badge clicked)
         └── CommentEditModal (when individual comment selected)
```

### 3.2 Rehydration Pipeline (Reload Path)

```
rehydrateElementMap()
    │
    ▼
For each sessionStorage item where isComment && commentText:
    │
    ├── Already in ELEMENT_MAP and .isConnected? → skip
    │
    └── findElementForItem(rg, item)
            │
            ├── 1. Build candidates: querySelectorAll(tagName)
            │      filtered by rg.getDisplayName() === componentName
            │
            ├── 2. Parse content → ParsedSnippet
            │      { sourceInfo, attributes, classTokens, innerText }
            │
            ├── 3. Strategy 1: Source match via rg.getSource()
            │      ├── Unique match → return element
            │      ├── Multiple matches → scoreElement() to pick best
            │      └── No matches → fall through
            │
            └── 4. Strategy 2: scoreElement() on all candidates
                   └── Highest score > -1 → return element
```

### 3.3 Component Hierarchy

```
CommentOverlayProvider                    ← wraps app children
  ├── {children}                          ← pass-through
  └── [isVisible && <CommentOverlay />]   ← conditional render
        │
        └── createPortal(…, document.body)
              ├── div (overlay container, fixed inset:0, pointer-events:none, z:99990)
              │     ├── ElementOverlay[]   ← per tracked element
              │     │     ├── div.box      ← bounding rect highlight
              │     │     └── div.badges   ← flex row of PillBadge (pointer-events:auto)
              │     └── div.orphans?       ← top-left corner stack
              ├── CommentListModal?        ← createPortal(…, document.body), z:99995
              └── CommentEditModal?        ← createPortal(…, document.body), z:99996
```

### 3.4 Technology Constraints

- React 18+ client components (`"use client"`)
- `createPortal` to `document.body` for all overlay and modal rendering
- `requestAnimationFrame` loop for position tracking — not scroll/resize listeners, not IntersectionObserver
- `sessionStorage` as the sole persistence layer (key: `"react-grab-recent-items"`)
- All styles are **inline React `style` objects** — no Tailwind, no CSS modules, no external stylesheets
- Depends on `window.__REACT_GRAB__` global providing: `registerPlugin()`, `getDisplayName(el)`, `getSource(el)` (async), `getState()`
- No dependencies beyond React and ReactDOM

---

## 4. Reproduction Steps

1. **Create the module-level element tracking bridge.** Declare a `Map<string, Element>` at module scope. At module evaluation time (top-level `if (typeof window !== "undefined")`), register a react-grab plugin via `rg.registerPlugin()`. Also listen for `"react-grab:init"` as a fallback. The plugin's `onCopySuccess` hook waits 50ms, reads `sessionStorage` items[0], maps its `id` to the DOM element, then dispatches a custom event.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L12-L58`

2. **Implement the content parser.** Split the stored `content` string on `"\n\n"` — for comment items, the HTML snippet is `parts[1]`. Extract: source file+line from the `"  in Component (at file:line)"` regex, all HTML attributes from the opening tag, class tokens with truncation awareness, and inner text lines.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L65-L136`

3. **Implement the element scorer.** Positive scoring for attribute matches (+50 for id/data-testid, +10 for others), class tokens (+3 each), and text content (+5 base, length-inverse bonus). Hard reject (-1) if any required class token is missing or if expected inner text is absent.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L142-L182`

4. **Implement the two-strategy element finder.** Filter candidates by `querySelectorAll(tagName)` + `getDisplayName()`. Try source file+line matching first via `rg.getSource()`. Fall back to attribute/text scoring. Disambiguate multi-source-matches with scoring.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L184-L266`

5. **Implement rehydration.** Iterate sessionStorage comment items. For each, skip if already in the map with a connected element. Otherwise, run the finder and store the result.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L272-L292`

6. **Build the provider.** Wrap children in a React context. Manage `isVisible`, `trackedElements`, `orphanComments`, and a `version` counter. Wire the "x" hotkey (with suppression for inputs and react-grab prompt mode). On mount, rehydrate. Listen for the custom update event. When `isVisible` or `version` changes, run `buildTrackedElements()` to re-partition items. Conditionally render `<CommentOverlay />` when visible.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L349-L498`

7. **Build the overlay component.** Portal to `document.body`. Start a rAF loop that reads `getBoundingClientRect()` from each tracked element every frame, filters zero-size, and merges overlapping rects (within 3px). Render per-element highlights and badge rows.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlay.tsx#L51-L197`

8. **Implement badge collapse.** 1-3 comments → individual pills with 20-char truncated text, each opens edit modal. 4+ → single count pill that opens list modal, which then drills into edit modal.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlay.tsx#L199-L283`

9. **Implement orphan rendering.** Comments without live DOM elements render as a column of pills in the top-left corner of the viewport. Each is clickable → edit modal.

   > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlay.tsx#L131-L170`

10. **Implement sessionStorage mutations.** `updateComment` rewrites `commentText` and reconstructs `content` (replace `parts[0]` after splitting on `"\n\n"`). `deleteComment` filters the item out. Both write the full array back and bump the version counter.

    > Follow 📎 `staging/web/src/app/comment-overlay/CommentOverlayProvider.tsx#L449-L479`

### What NOT to do

- **Do not put the element map in React state or a ref.** It must be module-level. React state would lose entries on unmount; a ref would be scoped to a single component instance. The map must be shared between the plugin callback (which runs outside React) and the provider component.
- **Do not register the react-grab plugin inside a useEffect or component body.** It runs at module evaluation time. If you register it lazily, you'll miss early captures.
- **Do not remove the 50ms setTimeout in onCopySuccess.** react-grab writes sessionStorage asynchronously after calling the hook. Reading immediately returns the previous state.
- **Do not use scroll/resize event listeners instead of the rAF loop.** Events miss layout shifts, CSS transitions, and programmatic scroll. The rAF loop handles all cases.
- **Do not use IntersectionObserver or ResizeObserver as a replacement.** They report visibility/size changes, not viewport-relative coordinates every frame.
- **Do not skip the `.isConnected` check on cached elements.** DOM elements can be removed (navigation, conditional rendering) while their map entries persist.
- **Do not use CSS classes or Tailwind for overlay styles.** The overlay portals to `document.body` and must be fully self-contained — it can't depend on the host app's stylesheet.
- **Do not change the sessionStorage key.** `"react-grab-recent-items"` is react-grab's own key. The overlay reads from and writes back to it.
- **Do not merge the two resolution strategies into one scoring pass.** Source file+line is strictly more precise than attribute scoring. It must be tried first, and attribute scoring is only a fallback.
- **Do not clear ELEMENT_MAP when the overlay is hidden.** It persists so the next toggle-on is instant for already-resolved elements.

---

## 5. Definition of Success

1. **"x" toggles the overlay** — pressing "x" when not in an input field and not in react-grab prompt mode shows pink bounding box highlights over every element that has comments in sessionStorage. Pressing "x" again hides them.
2. **Live capture works** — after using react-grab to add a comment to an element, the overlay immediately highlights that element on the next "x" toggle without needing a page reload.
3. **Reload resilience** — after a full page reload, pressing "x" highlights the same elements in the same positions. The source file+line strategy (or attribute scoring fallback) successfully re-finds them.
4. **Highlights track elements in real time** — scrolling, resizing, or triggering layout changes causes bounding boxes and badges to follow their elements smoothly, every frame.
5. **Badge collapse works** — an element with 1-3 comments shows individual pill badges; an element with 4+ comments shows a single "N comments" pill that opens a list.
6. **Orphan comments are visible** — comments whose DOM elements are missing or disconnected appear as pills in the top-left viewport corner, not silently dropped.
7. **Edit modal writes to sessionStorage** — editing a comment and saving updates the sessionStorage entry; the change persists after toggling the overlay off and on.
8. **Delete removes from sessionStorage** — deleting a comment removes it from the sessionStorage array; it's gone after reload.
9. **Hotkey suppression works** — typing "x" inside a text input, textarea, or contentEditable element does NOT toggle the overlay. Same when react-grab's prompt mode is active.
10. **Multiple comments on one element merge correctly** — if two sessionStorage items resolve to elements with identical bounding rects (within 3px), they appear as one highlight with combined badges, not stacked duplicates.

### What is NOT a success criterion

- The specific pink color values, font sizes, or modal dimensions — these are incidental prototype styling, not the approved behavior.
- Whether the code compiles or type-checks — the human approved runtime behavior, not build output.
- Whether react-grab itself works correctly — the spec assumes react-grab provides `registerPlugin()`, `getDisplayName()`, `getSource()`, and `getState()` as described.
- Performance metrics — the rAF loop should feel smooth, but no specific FPS target is defined.
- The exact z-index numbers — the layering order matters (overlay < list modal < edit modal), but the specific values (99990, 99995, 99996) are not the point.

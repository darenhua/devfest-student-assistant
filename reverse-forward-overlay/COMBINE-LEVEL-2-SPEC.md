# SPEC: Component Extraction Pipeline — Overlay Data to Prototype Branches

**Combines:**
- `src/app/modules/crazy-reverse-fwd/COMBINE-SPEC.md` — automated prototype pipeline (git-as-state + prompt generation + Claude SDK)
- `src/app/modules/first-ever-crazy-fwds/SPEC-comment-overlay.md` — comment overlay (react-grab integration, element capture, sessionStorage)
- `src/app/modules/first-ever-forwards/SPEC.md` — module page layout (title, subheading, card)

**Scope:** New feature — connecting live UI annotation (overlay) to an automated extraction pipeline
**Essence:** A developer annotates React components in the browser via react-grab comments. Those component+context pairs are imported into a dashboard, transformed into a structured manifest, and batch-converted into prototype branches — one per component. Each branch runs through a pipeline that generates an extraction spec (via Claude SDK) describing how to isolate that component, then an implementation plan, then pushes for review. The overlay is the funnel; the pipeline is the factory.

---

## 1. Purpose (WHAT)

The parent specs each solve a different piece:

- **Comment overlay** captures which components a developer cares about and why — by annotating them in the live browser. The output is `sessionStorage` full of `{ componentName, commentText, sourceFilePath, lineNumber }` entries.
- **Automated prototype pipeline** (COMBINE-SPEC) takes a reference module, generates a spec via Claude SDK, submits an implementation job, and manages the lifecycle through git commits. But it handles **one prototype at a time** and requires the user to manually pick a reference module.

This feature **fuses them**: the overlay's captured components become the pipeline's inputs. Instead of manually selecting a reference module, the system derives it from the overlay's source file path. Instead of creating one branch at a time, the system batch-creates N branches from N captured components. The developer's workflow becomes:

1. Browse any page in the app — a floating "Extract" pill (from the root layout) is always visible in the bottom-right corner, above react-grab's menu
2. Press "x" to toggle the overlay, use react-grab to annotate interesting components with comments describing what to extract
3. Click the floating "Extract (N)" button — from any page. The system reads sessionStorage, parses entries, and opens a slide-out panel with the transform table
4. For each entry, the developer can **edit/enrich the context** (the comment text is a seed, not the final word), toggle entries on/off, and preview the derived branch names
5. Click "Save & Create Branches" — the system saves a JSON manifest to disk and batch-creates all enabled entries as `prototype/{slug}` branches (each branch auto-runs init during creation), then navigates to the pipeline dashboard
6. The dashboard shows N branch cards, each at stage 1/5 (init already complete). The developer clicks through each branch's pipeline individually: generate extraction spec (async) → submit implementation → mark complete → push for review

### What's new vs. the parent specs

| Concern | COMBINE-SPEC (parent) | Comment Overlay (parent) | This feature |
|---------|----------------------|-------------------------|--------------|
| Input source | User picks a reference module | User annotates DOM elements | Overlay annotations become pipeline inputs |
| Number of prototypes | One at a time | N/A | N at once (batch from manifest) |
| Reference derivation | Manual module picker | N/A | Auto-derived from react-grab source file path |
| Context/intent | User types conversation dir + guide hint | Comment text on elements | Comment text enriched via form, becomes extraction context |
| Spec generation goal | Reproduce an entire module | N/A | Extract a specific component + integration plan |
| Manifest/plan | N/A | sessionStorage (raw) | JSON file (structured, persisted) |
| Pipeline mode | Forwards-only (4 stages) or reverse-and-forwards (5 stages) | N/A | Always `reverse-and-forwards` (5 stages) — extraction always needs spec generation |
| Template | `spec-gen-only.md` (whole-module reproduction) | N/A | New `extract-component-spec.md` (single-component extraction) |

### How it works (walkthrough)

1. The root layout (`src/app/layout.tsx`) wraps the entire app in `CommentOverlayProvider` and renders a **floating trigger button** — a thin, modern, fixed-position pill that hovers above the react-grab floating menu on every page
2. Developer browses any page — the source-of-truth prototype UIs, module pages, anything. They use react-grab to annotate components: a `<UserAvatar>` with "extract this avatar logic with the presence indicator", a `<SearchBar>` with "isolate the autocomplete behavior", etc.
3. **From any page**, the developer clicks the floating trigger button. This reads sessionStorage, parses comment entries into manifest entries, and either:
   - Opens a **slide-out panel / modal** with the transform table (quick flow — stays on current page), or
   - Navigates to `/modules/crazy-reverse-fwd` with the import pre-triggered (full flow — for detailed editing)
4. **Transform table**: each row shows component name, file path, line number, context (editable textarea), slug (editable), and an enable/disable toggle. Developer enriches contexts with more detail, disables the entries they don't want, adjusts slugs if needed
5. **Save & Create**: developer clicks the button. System:
   - Writes manifest JSON to `script/spec-gen-kit/output/manifest.json`
   - For each enabled entry, calls `POST /api/create-branch` with the slug → creates `prototype/{slug}` branch
   - Navigates to (or refreshes) the pipeline dashboard: N branch cards appear
6. **Per-branch pipeline** (on the dashboard page): each branch card shows stages 1-5. Init is already complete (auto-run during branch creation). The developer advances each remaining stage:
   - **Stage 2 (generate-spec)**: uses the new `extract-component-spec.md` template with `{{COMPONENT_PATH}}`, `{{COMPONENT_NAME}}`, `{{CONTEXT}}`, `{{LINE_NUMBER}}`. Runs **async** — clicks "Generate Extraction Spec", system kicks off Claude SDK in background (returns immediately), UI polls every 5s, auto-commits when done. Claude reads the source file, analyzes the component, writes an extraction spec + integration plan as `SPEC.md`
   - **Stage 3 (implementation-started)**: generates implement prompt → submits to mock queue
   - **Stage 4 (implementation-complete)**: marks done
   - **Stage 5 (push-for-review)**: pushes branch + creates PR

### Scope boundaries

- **Everything from COMBINE-SPEC's scope boundaries still applies.** Mock queue, budget-capped SDK calls, reused templates, no rebase/sync, no auth.
  > 📎 See `COMBINE-SPEC.md` §1, "Scope boundaries"
- **The overlay itself is NOT modified.** The `CommentOverlayProvider` and react-grab integration work exactly as specified in the overlay spec. This feature adds a floating trigger button alongside them in the root layout.
- **Source file path resolution is best-effort.** If react-grab's `content` field doesn't contain parseable source info, the entry is shown as "unresolvable" in the import table and the user must manually enter a file path.
- **The `CommentOverlayProvider` moves to the root layout.** It currently wraps individual pages (e.g., `first-ever-crazy-fwds/page.tsx`). For this feature, it must wrap `{children}` in `src/app/layout.tsx` so the overlay works on ALL pages — including the source-of-truth prototype UIs that the developer is annotating.
- **All LEVEL-2 branches use `reverse-and-forwards` mode** because extraction always requires generating a new spec via Claude SDK. The `forwards-only` mode from COMBINE-SPEC is not used here.
- **One manifest at a time.** Saving a new manifest overwrites the previous one. Historical manifests are not tracked.

---

## 2. Full Map (HOW)

### 2.1 Data Transformation: Overlay → Manifest — Core

This is the unique bridge between the two parent systems. The overlay's raw sessionStorage items are messy (HTML snippets, element tracking metadata, serialized content strings). The manifest is clean and purpose-built for the pipeline.

**Input (from sessionStorage):**

> 📎 See `first-ever-crazy-fwds/SPEC-comment-overlay.md` §2.11 for the `HistoryItem` shape: `{ id, content, elementName, tagName, componentName, isComment, commentText, timestamp }`

**Transformation steps (per item):**

1. Filter: `isComment === true && commentText` is truthy (same filter as the overlay provider)
2. Parse `content` to extract source info — reuse the `parseContentForMatch()` logic:
   > 📎 See `first-ever-crazy-fwds/SPEC-comment-overlay.md` §2.3 for the content parsing spec. The regex `\n\s+in\s+(?:\S+\s+\(at\s+)?([^):]+\.\w{1,4})(?::(\d+))?` extracts `filePath` and `lineNumber`.
3. Derive `componentName` from `item.componentName || item.elementName`
4. Derive `slug` from component name: `slugify(componentName)` (lowercase, strip non-alphanumeric, spaces/camelCase boundaries to hyphens)
5. Pre-fill `context` with `item.commentText`

**Output (manifest entry):**

```typescript
interface ManifestEntry {
  id: string;                // Original overlay item ID
  componentPath: string;     // e.g., "src/components/UserAvatar.tsx"
  lineNumber: number | null; // e.g., 42
  componentName: string;     // e.g., "UserAvatar"
  context: string;           // Comment text, potentially enriched by user
  slug: string;              // e.g., "user-avatar"
  enabled: boolean;          // User can toggle off
}

interface Manifest {
  createdAt: string;         // ISO timestamp
  entries: ManifestEntry[];
}
```

**User enrichment**: Between import and save, the user can:
- Edit `context` (textarea per entry) — add more detail about what to extract, what the integration target is, what behavior matters
- Edit `slug` — if the auto-derived name isn't right
- Toggle `enabled` — skip entries they don't want to process
- Manually enter `componentPath` — for entries where source parsing failed

### 2.2 Root Layout Integration & Floating Trigger Button — Core

The root layout (`src/app/layout.tsx`) is the integration point that makes this system work across all pages. Two things live here:

**1. `CommentOverlayProvider` wraps `{children}`**

The overlay provider moves from individual page files to the root layout. This means the overlay (press "x" to see highlights, annotate with react-grab) works on **every page in the app** — critically, on the source-of-truth prototype UIs the developer is annotating.

> 📎 See `first-ever-crazy-fwds/SPEC-comment-overlay.md` §2.1-§2.6 for the provider's full behavior. Nothing about the provider changes — only its mount location moves.

**Current root layout** (`src/app/layout.tsx`):
- Loads react-grab via `<Script>` with `strategy="beforeInteractive"` (already present)
- Renders `{children}` directly in `<body>`

**Modified root layout** adds:
- `CommentOverlayProvider` wrapping `{children}` (client component boundary needed — see note below)
- `ExtractionTriggerButton` as a sibling inside the provider

**Client component boundary:** Since `layout.tsx` is a server component by default and `CommentOverlayProvider` is a client component, the wrapping must use the standard pattern: create a thin client component (e.g., `ClientProviders.tsx`) that wraps children with the provider + trigger button, and render that in the layout.

**2. Floating Trigger Button (`ExtractionTriggerButton`)**

A fixed-position, always-visible button that sits on **every page**. This is the entry point to the extraction pipeline — the developer doesn't need to navigate to the dashboard first.

**Visual design:**
- Fixed position, bottom-right of viewport
- Sits **above** the react-grab floating menu (react-grab uses `z-index: 99999`; this button uses `z-index: 99998` and is positioned higher vertically — e.g., `bottom: 80px` to clear react-grab's default position)
- Thin, modern pill shape — compact, unobtrusive, doesn't interfere with page content
- Semi-transparent dark background with a subtle border (consistent with the overlay's pink/zinc aesthetic)
- Shows a count badge when there are comment items in sessionStorage (e.g., "3" in a small circle)
- Monospace text, small font — something like "Extract" or a small icon + "Extract (3)"

**Behavior on click:**
1. Read `sessionStorage["react-grab-recent-items"]`
2. Filter to comment items (`isComment && commentText`)
3. If no items → show a brief tooltip/toast: "No annotations yet. Use react-grab to comment on components."
4. If items exist → POST to `/api/import-overlay` to parse them into `ManifestEntry[]`
5. Open a **slide-out panel** (right side, or bottom sheet) with the transform table:
   - Same columns as the dashboard's Zone 1 (component name, file path, context textarea, slug, toggle)
   - "Save & Create Branches" button at the bottom
   - "Open Full Dashboard" link to navigate to `/modules/crazy-reverse-fwd`
6. On "Save & Create Branches" → POST to `/api/save-manifest` → navigate to the pipeline dashboard

**Why the trigger is in the root layout, not the dashboard page:**

The developer annotates components while **looking at them**. They're on `/modules/script-generator/` studying the UI. They press "x", see highlights, add comments via react-grab. Then they want to start the extraction pipeline **immediately** — without navigating away, finding the dashboard URL, and clicking import. The floating button lets them go from "annotation" to "manifest creation" in one click, from any page.

**sessionStorage polling for the count badge:**

The button needs to know how many comment items exist to show the count badge. Two approaches (implementer's choice):

- **Passive:** Read sessionStorage once on mount and on the `"comment-overlay-update"` custom event (which the overlay provider already dispatches when react-grab captures something)
- **Polling:** `setInterval` every 2-3 seconds to check sessionStorage length. Simpler but slightly wasteful.

The passive approach is preferred since the event infrastructure already exists.

### 2.3 Manifest Persistence — Supporting


The manifest JSON file lives at `script/spec-gen-kit/output/manifest.json`. This follows the same output directory pattern as the parent spec-generator.

> 📎 See `script-generator-reverse/SPEC.md` §2.1 for the output directory convention: `script/spec-gen-kit/output/` with auto-creation via `recursive: true`.

**Operations:**
- `saveManifest(manifest)` — JSON.stringify + writeFileSync to `manifest.json`
- `loadManifest()` — readFileSync + JSON.parse (returns null if not found)

The manifest is also consumed by the pipeline stages — the `generate-spec` stage reads it to get component-specific info (`componentPath`, `componentName`, `context`, `lineNumber`) for the current branch's slug.

### 2.4 Batch Branch Creation — Core

When the user clicks "Save & Create Branches", the system:

1. Filters manifest entries to `enabled === true`
2. Saves the manifest to disk
3. For each enabled entry, derives `sourceModulePath` from the entry's `componentPath` (parent directory — e.g., `src/components/UserAvatar.tsx` → `src/components/`)
4. For each enabled entry, calls `POST /api/create-branch` with `{ name: slug, sourceModulePath, mode: 'reverse-and-forwards' }`
5. Each `createBranch()` call validates the source path, creates the git branch, and **auto-runs the init commit**. Branches arrive with `completedStages: ['init']` and `nextStage: 'generate-spec'`
6. All branches are created as `prototype/{slug}` — same naming as COMBINE-SPEC

> 📎 See `COMBINE-SPEC.md` §2.3 for branch naming: `prototype/{slug}` format, `parseBranch()` extraction. Identical here.
> 📎 See `COMBINE-SPEC.md` §2.4 for branch creation + auto-init pattern. The only difference: LEVEL-2 always passes `mode: 'reverse-and-forwards'`.

**Collision handling**: If a branch `prototype/{slug}` already exists, the system appends a numeric suffix: `prototype/{slug}-2`, `prototype/{slug}-3`, etc. This is new — COMBINE-SPEC doesn't handle collisions because it creates one branch at a time interactively.

### 2.5 Pipeline Stages — Core

All LEVEL-2 branches use the **`reverse-and-forwards` mode** (5 stages) because component extraction always requires generating a new spec via Claude SDK.

> 📎 See `COMBINE-SPEC.md` §2.1 for the full stage pipeline definition, enforcement logic, and `STAGE_ORDER_REVERSE` array. All of that applies here.

**Stage modifications from COMBINE-SPEC's reverse-and-forwards mode:**

| # | Stage | What changes from COMBINE-SPEC |
|---|-------|-------------------------------|
| 1 | `init` | Auto-run during branch creation. Writes `pipeline.json` (with `mode: 'reverse-and-forwards'`) + copies source spec → `spec-parent.md` + writes `lineage.json` + placeholder `page.tsx`. The `sourceModulePath` is derived from the manifest entry's `componentPath` parent directory. |
| 2 | `generate-spec` | **Uses `extract-component-spec.md` template** instead of `spec-gen-only.md`. Reads `manifest.json` for component-specific params (componentPath, componentName, context, lineNumber). **Async** — background SDK with polling. |
| 3 | `implementation-started` | Unchanged from COMBINE-SPEC |
| 4 | `implementation-complete` | Unchanged |
| 5 | `push-for-review` | Unchanged |

**Stage 2 detail — generate-spec (modified):**

Instead of COMBINE-SPEC's spec-gen-only flow:
> 📎 See `COMBINE-SPEC.md` §2.6, Stage: generate-spec for the original flow.
> 📎 See `COMBINE-SPEC.md` §2.7 for the async SDK pattern (spec-task.ts, fire-and-forget, polling).

This stage uses the **async execution pattern** from COMBINE-SPEC:
1. User clicks "Generate Extraction Spec" → `POST /api/generate-spec/start { branch }`
2. Server validates stage order, reads `pipeline.json` via `git show` for sourceModule.path
3. Server reads `manifest.json` to get `componentPath`, `componentName`, `context`, `lineNumber` for this branch's slug
4. Reads the new `extract-component-spec.md` template
5. Substitutes: `{{COMPONENT_PATH}}` → componentPath, `{{COMPONENT_NAME}}` → componentName, `{{CONTEXT}}` → context, `{{LINE_NUMBER}}` → lineNumber (or "N/A")
6. Writes the generated prompt to `script/spec-gen-kit/output/{slug}-extract-spec-prompt.md`
7. Starts Claude SDK **in the background** (fire-and-forget promise, tracked by `lib/spec-task.ts`)
8. Returns immediately — UI polls `GET /api/generate-spec/status?branch=prototype/{slug}` every 5s
9. When task completes: UI auto-calls `POST /api/commit { branch, stage: "generate-spec" }` → `addCommit()` detects SPEC.md exists, skips SDK, stages + commits

Claude reads the component source file, analyzes it, writes `SPEC.md` with extraction plan + integration guidance.

The Claude SDK configuration is identical to COMBINE-SPEC:
> 📎 See `COMBINE-SPEC.md` §2.7 for SDK configuration: model, allowedTools, maxTurns, maxBudgetUsd, permissionMode. All values apply here.

### 2.6 New Template: `extract-component-spec.md` — Core

A new template at `script/spec-gen-kit/templates/extract-component-spec.md`. This is the key differentiator from COMBINE-SPEC's `spec-gen-only.md` — it instructs Claude to analyze a **single component** (not an entire module) and produce an **extraction spec + integration plan** (not a reproduction spec).

**Placeholders:**

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{{COMPONENT_PATH}}` | `manifest.json` → componentPath | `src/components/UserAvatar.tsx` |
| `{{COMPONENT_NAME}}` | `manifest.json` → componentName | `UserAvatar` |
| `{{CONTEXT}}` | `manifest.json` → context (user-enriched) | `Extract avatar logic with presence indicator...` |
| `{{LINE_NUMBER}}` | `manifest.json` → lineNumber | `42` or `N/A` |

**Template intent** (what it should tell Claude):

1. Read the component at `{{COMPONENT_PATH}}` (starting around line `{{LINE_NUMBER}}`)
2. Understand what this component does — its props, state, side-effects, dependencies, and how it integrates with its current parent/context
3. The developer wants to extract this component because: `{{CONTEXT}}`
4. Write a `SPEC.md` that covers:
   - **What to extract**: The component's core behavior, isolated from its current context
   - **Dependencies to carry**: What imports, hooks, utilities, or context providers this component needs
   - **What to leave behind**: Parts of the current implementation that are specific to the current app and should NOT be extracted
   - **Integration plan**: How the extracted component could be used in a new module — what props/API surface it should expose, what context it needs from the consumer
5. The spec should be written so a coding agent can create a standalone version of this component in a new module folder

**The template itself is a new file to be created.** Its exact wording is flexible — what matters is that it includes the four placeholders and instructs Claude to produce an extraction+integration spec.

### 2.7 Inherited Infrastructure

**From COMBINE-SPEC (reused directly):**
- Git operations, stash/unstash, stage state machine, `addCommit()`, `runSideEffect()` dispatch
  > 📎 See `COMBINE-SPEC.md` §2.5 for `addCommit()`, §2.6 for stage side-effects
- Pipeline metadata (`pipeline.json`, `lineage.json`)
  > 📎 See `COMBINE-SPEC.md` §2.2 for pipeline metadata and reading across branches
- API response envelope, route pattern
  > 📎 See `COMBINE-SPEC.md` §2.8 for API routes
- Mock worker queue
  > 📎 See `COMBINE-SPEC.md` §2.9 for queue schema and operations
- Claude SDK wrapper + async spec task tracker (`lib/spec-task.ts`) — in-memory `Map<branch, SpecTask>` for background SDK execution
  > 📎 See `COMBINE-SPEC.md` §2.7 for SDK integration and async task tracking
- Template engine (readTemplate, substituteTemplate, writeOutput)
  > 📎 See `COMBINE-SPEC.md` §2.6, referencing `script-generator-reverse/SPEC.md` §2.1

**From Comment Overlay (read-only consumption):**
- SessionStorage data shape (`HistoryItem`)
  > 📎 See `first-ever-crazy-fwds/SPEC-comment-overlay.md` §2.11
- Content parsing logic (source file extraction)
  > 📎 See `first-ever-crazy-fwds/SPEC-comment-overlay.md` §2.3

**From Module Page Layout:**
- Page shell structure (title, subheading, card, back link)
  > 📎 See `first-ever-forwards/SPEC.md` §3.2 for the component structure template

### 2.8 API Routes — Core

Builds on COMBINE-SPEC's 9 routes with 2 new ones for manifest operations (11 total):

| Route | Method | Purpose | New? |
|-------|--------|---------|------|
| `api/branches` | `GET` | List prototype branches with stage state + mode | No — from COMBINE-SPEC |
| `api/create-branch` | `POST` | Create branch + auto-init (takes `{ name, sourceModulePath, mode }`) | No — from COMBINE-SPEC (LEVEL-2 always passes `mode: 'reverse-and-forwards'`) |
| `api/commit` | `POST` | Execute stage side-effect + commit | No — modified generate-spec behavior (uses different template) |
| `api/generate-spec/start` | `POST` | Start async spec generation in background | No — from COMBINE-SPEC (LEVEL-2 uses `extract-component-spec.md` template) |
| `api/generate-spec/status` | `GET` | Poll spec generation status | No — from COMBINE-SPEC |
| `api/modules` | `GET` | List existing modules | No — from COMBINE-SPEC |
| `api/push` | `POST` | Push branch to origin | No — from COMBINE-SPEC |
| `api/create-pr` | `POST` | Create GitHub PR | No — from COMBINE-SPEC |
| `api/queue` | `GET` | List jobs in mock queue | No — from COMBINE-SPEC |
| **`api/import-overlay`** | **`POST`** | **Read sessionStorage items from request body, transform to manifest entries** | **Yes** |
| **`api/save-manifest`** | **`POST`** | **Save manifest JSON + batch-create branches for enabled entries** | **Yes** |

> 📎 All routes follow the same validate → call → respond pattern from `COMBINE-SPEC.md` §2.8.

**`api/import-overlay` detail:**

This route receives the raw sessionStorage items from the client (the client reads sessionStorage and POSTs the array). The server-side parsing extracts source info and builds manifest entries. This keeps the parsing logic server-side and consistent.

- Request: `{ items: HistoryItem[] }`
- Response: `{ entries: ManifestEntry[] }` — the pre-filled, un-saved entries for the UI to display

**`api/save-manifest` detail:**

- Request: `{ entries: ManifestEntry[] }` — the user-edited entries (context enriched, some disabled)
- Server:
  1. Saves full manifest (including disabled entries) to `manifest.json`
  2. Filters to enabled entries
  3. For each enabled entry:
     - Derives `sourceModulePath` from `componentPath` parent directory
     - Calls `createBranch({ name: slug, sourceModulePath, mode: 'reverse-and-forwards' })` (with collision suffix if needed)
     - Branch arrives with init already complete (auto-run)
  4. Returns the list of created branches (each at `nextStage: 'generate-spec'`)
- Response: `{ manifest: Manifest, branches: PrototypeBranch[] }`

### 2.9 Dashboard UI — Core

A `"use client"` page following the module page layout pattern.

> 📎 See `first-ever-forwards/SPEC.md` §3.2 for the page shell (back link, title, subheading, card).

The page has **two zones**:

**Zone 1: Import & Transform (top section)**

This is the form where overlay data gets converted to the manifest. Visible when no manifest has been saved yet (or when the user clicks "New Import").

1. **Import button** — "Import from Overlay". On click:
   - Client reads `sessionStorage["react-grab-recent-items"]`
   - POSTs the items array to `api/import-overlay`
   - Server returns parsed `ManifestEntry[]`
   - UI renders the transform table

2. **Transform table** — one row per entry:
   - Component name (read-only badge)
   - File path + line number (read-only, or editable text input if source parsing failed)
   - Context textarea (pre-filled with comment text, user can expand)
   - Slug input (auto-derived, editable)
   - Branch preview: `prototype/{slug}` (derived, read-only)
   - Enable/disable toggle

3. **Summary bar** — shows: `{enabled}/{total} components selected → {enabled} branches will be created`

4. **"Save & Create Branches" button** — POSTs to `api/save-manifest`, triggers batch creation, then scrolls to Zone 2

**Zone 2: Pipeline Dashboard (bottom section)**

This is the per-branch pipeline management UI from COMBINE-SPEC, showing all created branches.

> 📎 See `COMBINE-SPEC.md` §2.10 for the dashboard UI pattern: branch cards, stage progress, commit timeline, next-step panel.

**What's different from COMBINE-SPEC's UI:**

1. **Branch creation is in Zone 1 (import + save)** — branches come from the manifest, not a name input. After saving, branches arrive with init already complete. The "New Import" button replaces the "New Prototype" form.
2. **No init or set-reference panels** — init is automatic (runs during branch creation), and set-reference doesn't exist in the updated COMBINE-SPEC.
3. **Generate-spec panel is async** — shows the manifest-derived context (read-only) and component info, plus a "Generate Extraction Spec" button. On click, kicks off background Claude SDK. Shows spinner with elapsed time, polls every 5s, auto-commits when done. No conversation dir or guide hint inputs — the template uses component path + context instead.
4. **Mode badge** — each branch card shows "REV+FWD" badge (all LEVEL-2 branches use `reverse-and-forwards` mode).
5. **Manifest summary** — an optional collapsible section showing the full manifest as a reference table.

### 2.10 Type Definitions — Supporting

Extends COMBINE-SPEC's types:

> 📎 See `COMBINE-SPEC.md` §2.11 for base types: `PipelineMode`, `PipelineStage`, `STAGE_ORDER_FORWARDS`, `STAGE_ORDER_REVERSE`, `PipelineMeta`, `LineageInfo`, `PrototypeBranch`, `CommitRequest`, `CreateBranchRequest`, `QueueJob`, `ApiResponse<T>`.

New types (specific to LEVEL-2):

```typescript
// Raw overlay item (read from sessionStorage, matches overlay spec §2.11)
interface OverlayItem {
  id: string;
  content: string;
  elementName: string;
  tagName: string;
  componentName?: string;
  isComment: boolean;
  commentText?: string;
  timestamp: number;
}

// Cleaned-up entry for the manifest (the "friendlier data struct")
interface ManifestEntry {
  id: string;
  componentPath: string;
  lineNumber: number | null;
  componentName: string;
  context: string;
  slug: string;
  enabled: boolean;
}

interface Manifest {
  createdAt: string;
  entries: ManifestEntry[];
}

// Note: ComponentReference / reference.json no longer exist.
// Component-specific info is read from manifest.json during generate-spec.
// Pipeline metadata is stored in pipeline.json (see COMBINE-SPEC §2.2).

// CommitRequest from COMBINE-SPEC works as-is.
// The generate-spec stage reads manifest.json server-side — no extra user input needed.
// CreateBranchRequest from COMBINE-SPEC works as-is (LEVEL-2 always passes mode: 'reverse-and-forwards').
```

---

## 3. How the Parts Connect

```
┌─────────────────────────────────────────────────────────────────┐
│              src/app/layout.tsx (Root Layout)                     │
│                                                                  │
│  <Script src="react-grab" strategy="beforeInteractive" />       │
│  <ClientProviders>                                               │
│    <CommentOverlayProvider>  ← wraps ALL pages                  │
│      {children}              ← any page in the app              │
│      <ExtractionTriggerButton />  ← floating pill, every page   │
│    </CommentOverlayProvider>                                     │
│  </ClientProviders>                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────────┐
          │                                     │
          ▼                                     ▼
┌──────────────────────────┐    ┌──────────────────────────────────┐
│  Any page in the app      │    │  ExtractionTriggerButton          │
│                           │    │  (fixed position, bottom-right,   │
│  Developer annotates      │    │   above react-grab menu)          │
│  components via react-    │    │                                    │
│  grab → comments stored   │    │  Shows count badge: "Extract (3)" │
│  in sessionStorage        │    │  On click:                         │
│                           │    │   1. Read sessionStorage            │
│  Press "x" to toggle      │    │   2. POST /api/import-overlay      │
│  overlay highlights       │    │   3. Open slide-out panel with     │
│                           │    │      transform table               │
└───────────────────────────┘    │   4. "Save & Create" → POST       │
                                 │      /api/save-manifest            │
                                 │   5. Navigate to dashboard         │
                                 └──────────────┬─────────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│       /modules/crazy-reverse-fwd/page.tsx — Pipeline Dashboard   │
│                                                                  │
│  ZONE 1: Import & Transform (also accessible from here)         │
│   ├── "Import from Overlay" button (same flow as trigger)       │
│   ├── Transform Table (editable)                                │
│   │    ├── Component name (read-only)                           │
│   │    ├── File path (read-only or manual entry)                │
│   │    ├── Context textarea (editable, pre-filled)              │
│   │    ├── Slug input (editable, auto-derived)                  │
│   │    └── Enable/disable toggle                                │
│   └── "Save & Create Branches" button                           │
│                                                                  │
│  ZONE 2: Pipeline Dashboard                                     │
│   ├── Branch cards (one per manifest entry / created branch)    │
│   │    ├── Mode badge: "REV+FWD" (all LEVEL-2 branches)        │
│   │    ├── StageProgress (5 stages, from git log)              │
│   │    ├── CommitTimeline                                       │
│   │    └── NextStepPanel (stage-specific)                       │
│   │         ├── [generate-spec] → async: shows context +        │
│   │         │    component, "Generate Extraction Spec" button,  │
│   │         │    spinner + elapsed time, polls every 5s         │
│   │         ├── [impl-started] → "Submit Job" button           │
│   │         ├── [impl-complete] → "Mark Complete" button       │
│   │         └── [push-for-review] → PR title + push button     │
│   │                                                              │
│   On mount: GET /api/branches → show all prototype/* branches   │
│   After any mutation: refresh branches                          │
└──────────────────┬──────────────────────────────────────────────┘
                   │ fetch (JSON)
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Routes (11 routes)                               │
│  9 from COMBINE-SPEC + 2 new                                    │
│                                                                  │
│  NEW: api/import-overlay                                        │
│   → receives raw HistoryItem[], parses source info,             │
│     returns ManifestEntry[]                                     │
│                                                                  │
│  NEW: api/save-manifest                                         │
│   → saves manifest.json, batch-creates branches (auto-init)    │
│                                                                  │
│  FROM COMBINE-SPEC (modified behavior):                         │
│   api/generate-spec/start → uses extract-component-spec.md      │
│     template, reads manifest.json for component params          │
│   api/generate-spec/status → polls async task (unchanged)       │
│   api/create-branch → LEVEL-2 always passes mode:              │
│     'reverse-and-forwards' + sourceModulePath from manifest     │
└──────────────────┬──────────────────────────────────────────────┘
                   │ function calls
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              lib/pipeline.ts                                      │
│                                                                  │
│  INHERITED from COMBINE-SPEC:                                   │
│   exec(), stash(), unstash(), getCurrentBranch(),               │
│   getCommitsForBranch(), getCompletedStages(),                  │
│   getNextStage(commits, mode?), parseBranch(), addCommit(),     │
│   readPipelineMetaFromBranch(), createBranch()                  │
│                                                                  │
│  INHERITED from COMBINE-SPEC (template engine):                 │
│   readTemplate(), substituteTemplate(), writeOutput()           │
│                                                                  │
│  INHERITED from COMBINE-SPEC (queue + SDK + async):             │
│   appendToQueue(), generateSpecWithClaude()                     │
│   lib/spec-task.ts — in-memory task tracking (async spec gen)   │
│                                                                  │
│  NEW:                                                            │
│   parseOverlayItems(items) → ManifestEntry[]                    │
│   saveManifest(manifest) / loadManifest()                       │
│   getManifestEntryForSlug(slug) → ManifestEntry | null          │
│                                                                  │
│  MODIFIED side-effects in runSideEffect():                      │
│   generate-spec: reads manifest.json for component info,        │
│     uses extract-component-spec.md template                     │
└──────────────────┬──────────────────────────────────────────────┘
                   │ execSync / fs / Claude SDK
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  Local git repo           Templates               Manifest      │
│  - prototype/* branches   - extract-component-     - JSON file  │
│  - commits with [tags]      spec.md (NEW)          - at output/ │
│  - pipeline.json           - implement.md (reused)               │
│  - lineage.json                                                  │
│  - module folders                                                │
│                                                                  │
│  Claude Code SDK (async, background)                             │
│  - Reads component source file (not whole module)               │
│  - Writes extraction SPEC.md + integration plan                 │
└─────────────────────────────────────────────────────────────────┘
```

### Critical Data Flow: Import → Transform → Create

```
User clicks floating "Extract (3)" button (from ANY page)
  OR clicks "Import from Overlay" on the dashboard page
        │
        ▼
Client: read sessionStorage["react-grab-recent-items"]
        │
        ▼
POST /api/import-overlay { items: HistoryItem[] }
        │
        ▼
Server: for each item where isComment && commentText:
  ├── Parse content string for source info
  │   (regex: /\n\s+in\s+(?:\S+\s+\(at\s+)?([^):]+\.\w{1,4})(?::(\d+))?/)
  ├── Derive componentName, slug
  └── Return ManifestEntry with enabled=true, context=commentText
        │
        ▼
Client: render Transform Table (user edits context, toggles, adjusts slugs)
        │
        ▼
User clicks "Save & Create Branches"
        │
        ▼
POST /api/save-manifest { entries: ManifestEntry[] }
        │
        ▼
Server:
  ├── Write manifest.json to script/spec-gen-kit/output/
  ├── Filter to enabled entries
  ├── For each enabled entry:
  │    ├── Check if prototype/{slug} exists → append suffix if needed
  │    ├── Derive sourceModulePath from componentPath parent dir
  │    └── POST /api/create-branch { name: slug, sourceModulePath,
  │         mode: 'reverse-and-forwards' }
  │         → creates branch + auto-runs init (writes pipeline.json,
  │           copies spec → spec-parent.md, writes lineage.json,
  │           placeholder page.tsx, commits [init])
  └── Return { manifest, branches: PrototypeBranch[] }
        │
        ▼
Client: refresh branches → N branch cards appear at stage 1/5
        (init already complete, next: generate-spec)
```

### Critical Data Flow: Generate Extraction Spec (Stage 2 — async)

```
User clicks "Generate Extraction Spec" on branch prototype/user-avatar
        │
        ▼
POST /api/generate-spec/start { branch: "prototype/user-avatar" }
        │
        ▼
Server:
  ├── 1. Validate stage order (generate-spec must be next)
  ├── 2. Read pipeline.json via git show (no checkout)
  │      → { mode, sourceModule: { path: "src/components/", ... } }
  ├── 3. Read manifest.json → find entry for slug "user-avatar"
  │      → { componentPath, componentName, context, lineNumber }
  ├── 4. Read extract-component-spec.md template
  ├── 5. Substitute placeholders:
  │      {{COMPONENT_PATH}} → "src/components/UserAvatar.tsx"
  │      {{COMPONENT_NAME}} → "UserAvatar"
  │      {{CONTEXT}} → "Extract avatar logic with presence indicator..."
  │      {{LINE_NUMBER}} → "42"
  ├── 6. Write prompt to output/user-avatar-extract-spec-prompt.md
  ├── 7. Ensure module dir exists on disk (mkdir -p)
  ├── 8. Start Claude SDK in background (fire-and-forget promise)
  │      Tracked by lib/spec-task.ts in-memory Map
  └── 9. Return immediately: { status: "started" }
        │
        ▼
UI polls GET /api/generate-spec/status?branch=prototype/user-avatar
  every 5 seconds (shows spinner + elapsed time)
        │
        ▼ (when task.status === "complete")
        │
POST /api/commit { branch: "prototype/user-avatar", stage: "generate-spec" }
        │
        ▼
addCommit() checks out branch
  ├── runSideEffect("generate-spec") detects SPEC.md exists → skips SDK
  ├── git add src/app/modules/user-avatar/
  └── git commit -m "[generate-spec] Extraction spec for: user-avatar"
```

---

## 4. Reproduction Steps

**Phase 1: Types**

1. Extend COMBINE-SPEC's types with `ManifestEntry`, `Manifest`, and `OverlayItem` — **Core**
   > 📎 See §2.10 above for the type definitions. Note: `ComponentReference` no longer exists — component info is read from `manifest.json`.

**Phase 2: Root Layout Integration**

2. Create `src/app/ClientProviders.tsx` — a `"use client"` wrapper that renders `CommentOverlayProvider` around `{children}` and includes `ExtractionTriggerButton` — **Core**
   > 📎 See §2.2 above for the root layout integration pattern.

3. Modify `src/app/layout.tsx` — wrap `{children}` with `<ClientProviders>` to enable overlay + trigger on all pages — **Core**

4. Create `ExtractionTriggerButton` component — fixed-position floating pill with count badge, slide-out panel with transform table — **Core**
   > 📎 See §2.2 above for visual design, positioning, and behavior.

**Phase 3: Template**

5. Create `script/spec-gen-kit/templates/extract-component-spec.md` with the four placeholders (`{{COMPONENT_PATH}}`, `{{COMPONENT_NAME}}`, `{{CONTEXT}}`, `{{LINE_NUMBER}}`) — **Core**
   > 📎 See §2.6 above for placeholder table and template intent.

**Phase 4: Lib (manifest + parsing)**

6. Add `parseOverlayItems(items)` function — parses raw `HistoryItem[]` into `ManifestEntry[]` using the source-info regex from the overlay spec — **Core**

7. Add `saveManifest(manifest)`, `loadManifest()`, `getManifestEntryForSlug(slug)` — JSON file I/O at `script/spec-gen-kit/output/manifest.json` — **Supporting**

8. Modify `runSideEffect()` — update `generate-spec` to read `manifest.json` for component info (componentPath, componentName, context, lineNumber) and use `extract-component-spec.md` template with component-level placeholders — **Core**

9. Reuse `lib/spec-task.ts` from COMBINE-SPEC — in-memory task tracker for async spec generation (fire-and-forget promise, polling) — **Core**
   > 📎 See `COMBINE-SPEC.md` §2.7 for the spec-task pattern.

**Phase 5: API Routes**

10. Create `api/import-overlay/route.ts` — POST handler that receives `{ items }`, calls `parseOverlayItems()`, returns entries — **Core**

11. Create `api/save-manifest/route.ts` — POST handler that saves manifest, batch-creates branches (each with auto-init via `createBranch({ name, sourceModulePath, mode: 'reverse-and-forwards' })`), returns branches at `nextStage: 'generate-spec'` — **Core**

12. Ensure COMBINE-SPEC's `api/generate-spec/start` and `api/generate-spec/status` routes work with the modified template (uses `extract-component-spec.md` and reads `manifest.json` for component params) — **Core**
    > 📎 See `COMBINE-SPEC.md` §2.8 for the generate-spec API routes.

**Phase 6: Dashboard UI**

13. Create `page.tsx` with Zone 1 (import + transform) and Zone 2 (pipeline dashboard) — **Core**
    - No init or set-reference panels (init is automatic, set-reference doesn't exist)
    - Generate-spec panel uses async pattern: "Generate Extraction Spec" button → spinner + elapsed time → polls every 5s → auto-commits when done
    - Mode badge on each branch card: "REV+FWD"
    - 5-stage progress bar (not 4 or 6)
    > 📎 Use `first-ever-forwards/SPEC.md` §3.2 for the page shell.
    > 📎 Reuse COMBINE-SPEC's dashboard patterns for Zone 2 (§2.10).

### What NOT to do

- **Everything from COMBINE-SPEC's "What NOT to do" still applies.**
  > 📎 See `COMBINE-SPEC.md` §4, "What NOT to do"
- **Do NOT modify the overlay's sessionStorage format.** This feature is a read-only consumer of `"react-grab-recent-items"`. It does not write back to that key.
- **Do NOT put the floating trigger button below react-grab's menu.** It must sit visually above (higher `bottom` offset) so both are accessible. Check z-index layering: react-grab is `z-index: 99999`, the overlay portal is `99990`, the trigger button should be `99998` (below react-grab but above overlay).
- **Do NOT make the source file path parsing a hard requirement.** If `content` doesn't contain parseable source info, show the entry as "unresolvable" with a manual file path input. Don't skip the entry silently.
- **Do NOT auto-advance stages.** Branches are batch-created, but each branch's stages are advanced one at a time by user action. The user clicks through each branch individually.
- **Do NOT deduplicate overlay items by component.** If the developer annotated the same component twice with different comments, those are two separate manifest entries → two branches. The comments capture different extraction intents.
- **Do NOT await the Claude SDK call inside the API route.** Use async background execution with polling (same pattern as `COMBINE-SPEC.md` §4).

---

## 5. Definition of Success

**Gestalt check:** A developer browses a prototype page, uses react-grab to annotate 4 components. A floating "Extract (4)" pill is visible in the bottom-right corner, above the react-grab menu. They click it, a slide-out panel shows 4 entries with auto-resolved file paths and pre-filled contexts. They enrich one context, disable one entry, click "Save & Create Branches." They're taken to the pipeline dashboard where 3 branches appear, each with init already complete (stage 1/5). They click through each branch's remaining stages — generate-spec runs async in the background, then implementation, then push. By the end, each branch has an extraction spec that Claude wrote by reading the actual component source file, plus an implementation prompt in the mock queue, and a PR created.

**Specific checks:**

1. **Floating trigger button is visible on all pages** — The `ExtractionTriggerButton` renders as a fixed-position pill on every page in the app. It shows a count badge reflecting the number of comment items in sessionStorage. It sits visually above the react-grab floating menu.
2. **Import resolves source paths** — Overlay items with source info in their `content` field are parsed to extract `componentPath` and `lineNumber`. The transform table shows these resolved paths.
3. **User can enrich context** — The context textarea is editable. Whatever the user writes is saved in `manifest.json` and gets substituted into the template as `{{CONTEXT}}` during generate-spec.
4. **Batch branch creation works** — Clicking "Save & Create Branches" creates N branches simultaneously, each with init already complete (auto-run). All appear in the pipeline dashboard at stage 1/5 with `nextStage: 'generate-spec'`.
5. **Manifest drives generate-spec** — The `generate-spec` stage reads `manifest.json` to get `componentPath`, `componentName`, `context`, `lineNumber` for the branch's slug. No module picker, no separate reference file.
6. **Extraction spec is component-specific** — The `generate-spec` stage uses `extract-component-spec.md` (not `spec-gen-only.md`). The prompt tells Claude to read a specific file and write an extraction+integration spec.
7. **Stage enforcement works** — Same as COMBINE-SPEC: stages can't be skipped, 409 on violation, git is the source of truth. Mode is always `reverse-and-forwards` (5 stages).
   > 📎 See `COMBINE-SPEC.md` §5, checks #1 and #2
8. **Manifest persists to disk** — `script/spec-gen-kit/output/manifest.json` exists after save and contains the full manifest with all entries (enabled and disabled).
9. **Async spec generation works** — Clicking "Generate Extraction Spec" returns immediately, shows spinner with elapsed time, polls every 5s, auto-commits when done.
10. **Pipeline stages after generate-spec work identically to COMBINE-SPEC** — Implementation job queued (implementation-started), `.complete` marker written (implementation-complete), branch pushed and PR created (push-for-review).
   > 📎 See `COMBINE-SPEC.md` §5, checks #9, #10
11. **Slug collision handling** — If `prototype/user-avatar` already exists, the system creates `prototype/user-avatar-2` instead of failing.
12. **Disabled entries are not branched** — Toggling an entry off in the transform table excludes it from branch creation. It's still in the manifest file but has `enabled: false`.
13. **Root layout integration works** — The `CommentOverlayProvider` wraps all pages. The overlay (press "x") and the floating trigger button both function on every page, including source-of-truth prototype UIs.

### What is NOT a success criterion

- **Exact styling or colors** — Any clean, functional dark-themed dashboard works. The floating button should look modern and unobtrusive but exact dimensions/colors are flexible.
  > 📎 Same as `COMBINE-SPEC.md` §5, "What is NOT a success criterion"
- **Real worker queue integration** — Mock (JSON file) is sufficient.
- **Streaming Claude SDK output to the UI** — A polling spinner with elapsed time is enough (same as COMBINE-SPEC).
- **The exact wording of the extract-component-spec.md template** — The placeholders and intent matter, the prose is flexible.
- **Whether the import can merge with an existing manifest** — Overwrite semantics are fine for the prototype.

# SPEC: Git-as-State — Full Reproduction

**Source of truth:** `src/app/modules/git-as-state/`
**Approved by:** Human developer (prototype review)
**Scope:** Full prototype reproduction
**Essence:** A Next.js API layer that wraps local git operations (branch, commit, push, PR, sync, rebase) with an enforced commit pipeline state machine — where git itself is the only source of truth — and a dashboard UI that drives it all.

---

## 1. Purpose (WHAT)

This prototype turns git into a state management system for prototype development workflows. Instead of tracking prototype progress in a database or config file, the system reads git commit history to determine what stage each prototype branch is at. Every branch goes through an enforced pipeline of commits (init folder → clone reference → include spec → implementation done → free commits), and trying to skip a stage returns a 409.

### How it works (walkthrough)

1. A developer visits the dashboard at `/modules/git-as-state`
2. They click "New Prototype", pick a type (Prototype/Integration/Completion), and enter a name like "auth-flow"
3. The system creates a git branch `prototype/001-auth-flow` — the type becomes the directory prefix, the ID auto-increments globally, the name is slugified
4. A card appears showing the branch at stage 0/4 with a "Run: Init Folder" button
5. Clicking it hits `POST /api/commit` which: switches to the branch, validates the stage order by reading git history, runs a side-effect (creates `prototypes/001-auth-flow/page.tsx`), commits it with message `[init-folder] Initialize prototype: 001-auth-flow`, switches back
6. The card updates to stage 1/4. The next button is "Run: Clone Reference"
7. This continues through the pipeline. At stage 3 ("include-spec"), the UI shows a textarea for spec content. At stage 4 ("generic"), it shows a free-form commit message input
8. At any point, the developer can Push, Sync, Create PR, or Rebase onto a selected main commit
9. **If the developer does a `git reset` on the branch, the stage reverts. If they manually create a commit with `[init-folder]` in the message, the system recognizes it.** Git is the single source of truth.

### The human's vision (from conversation)

The human was building a system where **git branches represent prototypes** and **git commit history represents prototype lifecycle state**. The key obsessions across all 4 prompts:

1. **Git as sole state source** (Prompt 3 explicitly confirmed): "the state machine reads the actual git commit history to determine where a branch is in its pipeline... No database, no config file, no in-memory state."

2. **Enforced commit pipeline with side-effects** (Prompt 1): Each stage has a "callback" — code that executes as a side-effect to mutate the filesystem before the commit. The commit API takes a stage, validates order, runs the side-effect, then commits. This was described as "create-commit function should take in basically something like a callback."

3. **Branch naming as metadata** (Prompts 2→3): Started with `PRO-001-slug` in branch name, then the human corrected: "actually just do `prototype/<branchname>` or `integration/<branchname>` — it's redundant to do it twice." The type IS the directory prefix.

4. **Rebase with safety** (Prompt 4): Must show a dropdown of main commits, rebase onto selected one, and "simply throw error and abort if there are rebase merge issues."

5. **Full API surface** (guide hint): "all the git related features including but not limited to the api interface and how the frontend interacts with it."

### Scope boundaries

- **`clone-reference` is stubbed**: Scaffolds a minimal template instead of running `create-next-app`. The human accepted this: "make sure any stuff you can't do is stubbed out."
- **`create-pr` falls back**: Tries `gh pr create`, falls back to a constructed comparison URL if `gh` CLI isn't available.
- **`hasPR` is always false**: Checked separately if needed, but not implemented in `listPrototypeBranches`.
- **No authentication/authorization**: All operations execute directly on the local filesystem.

---

## 2. Full Map (HOW)

### 2.1 Stage State Machine (git-derived) — Core

The pipeline stage system is the central innovation of this prototype. It enforces a strict commit order by reading git commit messages.

📎 `src/app/modules/git-as-state/types.ts#L52-L81`

**Stage pipeline (must be in this exact order):**

| Stage | Commit prefix | Side-effect | Unlocks |
|---|---|---|---|
| `init-folder` | `[init-folder]` | Creates `prototypes/{name}/page.tsx` | `clone-reference` |
| `clone-reference` | `[clone-reference]` | Scaffolds template files in prototype dir | `include-spec` |
| `include-spec` | `[include-spec]` | Writes `spec.md` (accepts content via API) | `implementation-done` |
| `implementation-done` | `[implementation-done]` | Creates `.complete` marker file | `generic` |
| `generic` | (no prefix required) | None (user makes changes manually) | `generic` (repeatable) |

**How the state machine works:**

📎 `src/app/modules/git-as-state/lib/git.ts#L93-L189`

1. `parseStageFromMessage(message)` — regex `^\[([^\]]+)\]` extracts stage tag from commit message (L93-98)
2. `getCommitsForBranch(branchName)` — runs `git log main..{branch}` and parses each commit (L138-162)
3. `getCompletedStages(commits)` — filters commits to those with recognized stage tags, excluding `generic` (L164-170)
4. `getNextStage(commits)` — derives the next allowed stage from completed stages (L172-189):
   - No stages completed → `init-folder`
   - Last completed is `implementation-done` → `generic`
   - Otherwise → next stage in `STAGE_ORDER`
5. `createCommit()` validates `nextAllowed === requestedStage` before executing; returns 409 on mismatch (L276-335)

**Critical detail:** The commit message format `[stage-tag] Description` is the wire protocol between the system and git. The regex at L94 is the parser. If a commit message doesn't start with a recognized `[tag]`, it's treated as a non-stage commit (stage = null).

### 2.2 Side-Effect Execution Pattern — Core

Each stage has a filesystem side-effect that runs before the commit. This is the "callback" the human described.

📎 `src/app/modules/git-as-state/lib/git.ts#L337-L480`

The `runSideEffect(stage, prototypeName, options)` function is a switch statement over stages:

- **`init-folder`** (L345-362): `mkdir` + write `page.tsx` with a React component
- **`clone-reference`** (L365-441): Write `package.json`, `tsconfig.json`, `next.config.ts`, `layout.tsx` — **this is the stub**
- **`include-spec`** (L443-465): Write `spec.md` with provided content or a template
- **`implementation-done`** (L468-474): Write `.complete` marker with timestamp
- **`generic`** (L476-478): No predefined side-effect

All files are scoped to `prototypes/{NNN-slug}/`. For `generic` commits, `git add -A` is used instead of scoped add (L309-313).

### 2.3 Branch Naming Convention — Core

Encodes prototype type and ID directly in the git branch name.

📎 `src/app/modules/git-as-state/lib/git.ts#L56-L91`
📎 `src/app/modules/git-as-state/types.ts#L1-L47`

**Format:** `{type_prefix}/{NNN}-{slug}`

| Type code | Branch prefix | Example |
|---|---|---|
| `PRO` | `prototype/` | `prototype/001-auth-flow` |
| `INT` | `integration/` | `integration/002-data-sync` |
| `COM` | `completion/` | `completion/003-polish` |

- `NNN` is zero-padded 3-digit auto-incrementing ID, global across all types (L77-91)
- `slug` is derived from the human-provided name via `slugify()` (L42-47)
- `parseBranchFull()` parses a branch name back to `BranchMetadata { type, id, slug }` (L61-75)
- Regex for slug portion: `/^(\d{3})-(.+)$/` (L59)

### 2.4 Branch Safety (stash/unstash) — Core

All mutating operations stash current work before switching branches, then restore after.

📎 `src/app/modules/git-as-state/lib/git.ts#L119-L130`

The pattern used in `createCommit`, `syncBranch`, and `rebaseBranch`:
```
previousBranch = getCurrentBranch()
didStash = stash()
try {
  git checkout targetBranch
  // ... do work ...
} finally {
  git checkout previousBranch (allowFailure)
  if (didStash) unstash()
}
```

This is safety-critical: the API runs in a Next.js server that might be on a different branch than the prototype being operated on.

### 2.5 Git Command Layer — Core

Wraps `execSync` with error handling, timeout, and CWD set to repo root.

📎 `src/app/modules/git-as-state/lib/git.ts#L25-L40`

- All commands run with `cwd: REPO_ROOT` (which is `process.cwd()`)
- 30-second timeout
- `allowFailure` option returns empty string instead of throwing
- Error messages extract stderr from the error object

### 2.6 API Routes — Core

Eight Next.js App Router API routes that expose the git operations:

| Route | Method | Purpose | Request body | Response |
|---|---|---|---|---|
| `/api/branches` | `GET` | List all managed branches with stage state | — | `PrototypeBranch[]` |
| `/api/create-branch` | `POST` | Create new branch from main | `{ name, type }` | `PrototypeBranch` |
| `/api/commit` | `POST` | Execute stage side-effect + commit | `{ branch, stage, message?, specContent? }` | `PrototypeCommit` |
| `/api/push` | `POST` | Push branch to origin | `{ branch }` | `{ output }` |
| `/api/create-pr` | `POST` | Create GitHub PR (with fallback) | `{ branch, title, body? }` | `{ url, stubbed }` |
| `/api/sync` | `POST` | Pull from origin | `{ branch }` | `{ output }` |
| `/api/main-commits` | `GET` | List commits on main (for rebase target) | `?limit=N` | `MainCommit[]` |
| `/api/rebase` | `POST` | Rebase branch onto main commit | `{ branch, ontoCommit }` | `{ message }` |

📎 `src/app/modules/git-as-state/api/branches/route.ts`
📎 `src/app/modules/git-as-state/api/create-branch/route.ts`
📎 `src/app/modules/git-as-state/api/commit/route.ts`
📎 `src/app/modules/git-as-state/api/push/route.ts`
📎 `src/app/modules/git-as-state/api/create-pr/route.ts`
📎 `src/app/modules/git-as-state/api/sync/route.ts`
📎 `src/app/modules/git-as-state/api/main-commits/route.ts`
📎 `src/app/modules/git-as-state/api/rebase/route.ts`

**All routes follow the same pattern:**
1. Parse and validate request body
2. Call the corresponding function in `lib/git.ts`
3. Return `{ ok: true, data: ... }` or `{ ok: false, error: ... }` with appropriate HTTP status
4. Commit route returns 409 for stage validation failures; rebase route returns 409 for conflicts

### 2.7 Rebase Feature — Core

📎 `src/app/modules/git-as-state/lib/git.ts#L529-L597`

- `getMainCommits(limit)` — reads `git log main` for rebase target selection (L529-549)
- `rebaseBranch(branchName, ontoCommit)` — validates commit is on main via `git branch --contains`, then runs `git rebase <commit>`. **On any conflict, immediately runs `git rebase --abort`** and throws, leaving the branch unchanged (L553-597)

### 2.8 Unified Response Envelope — Supporting

📎 `src/app/modules/git-as-state/types.ts#L152-L156`

```typescript
interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
```

All API routes return this shape. The frontend `apiFetch` helper deserializes it generically.

### 2.9 TypeScript Types — Supporting

📎 `src/app/modules/git-as-state/types.ts`

Defines all interfaces, stage constants, type labels, and color mappings. Must exist for type safety, but the exact constant values (colors, labels) are incidental.

### 2.10 Dashboard UI — Supporting

📎 `src/app/modules/git-as-state/page.tsx`

A `"use client"` page component with:

- **API helper functions** (L26-91): Thin wrappers around `fetch` to each route
- **StageProgress** component (L97-158): Visual pipeline progress dots
- **CommitTimeline** component (L164-197): Vertical timeline of commits on a branch
- **NextStepPanel** component (L216-302): Renders the appropriate UI for the current stage (button, textarea for spec, or input for generic message)
- **BranchCard** component (L308-658): Full card for each branch — header with type badge, stage progress, commit timeline, next step, action buttons (Push/PR/Sync/Rebase), rebase dropdown, toast notifications
- **GitAsStatePage** main component (L664-883): Branch list, create form with type selector and name input with prefix preview

The UI is functional but its exact layout, colors, and component structure are flexible. What matters is that it **exposes all API operations** and **shows the stage pipeline state visually**.

### 2.11 Configuration Constants — Incidental

📎 `src/app/modules/git-as-state/lib/git.ts#L17-L21`

- `REPO_ROOT = process.cwd()` — the git repo root
- `PROTOTYPES_DIR = path.join(REPO_ROOT, 'prototypes')` — where side-effects write files
- `BASE_BRANCH = 'main'` — the base branch for branching and diffing

These could be configurable. The names are not critical.

### 2.12 Styling and Visual Design — Incidental

The page uses Tailwind CSS utility classes with a dark zinc-950 theme. Colors for type badges (sky/amber/emerald) and stage indicators are defined in `PROTOTYPE_TYPE_COLORS`. All visual styling is flexible — the human never corrected visual design choices.

---

## 3. How the Parts Connect

```
┌─────────────────────────────────────────────────────┐
│                    page.tsx (UI)                      │
│                                                       │
│  GitAsStatePage                                       │
│   ├── Create form → POST /api/create-branch           │
│   └── BranchCard[] (one per branch)                   │
│        ├── StageProgress (reads completedStages)      │
│        ├── CommitTimeline (reads commits[])            │
│        ├── NextStepPanel → POST /api/commit            │
│        ├── Push button → POST /api/push                │
│        ├── PR form → POST /api/create-pr               │
│        ├── Sync button → POST /api/sync                │
│        └── Rebase panel                                │
│             ├── GET /api/main-commits → dropdown       │
│             └── POST /api/rebase                       │
│                                                       │
│  On mount: GET /api/branches → setBranches()          │
│  After any mutation: GET /api/branches (refresh)      │
└───────────────┬───────────────────────────────────────┘
                │  fetch (JSON)
                ▼
┌─────────────────────────────────────────────────────┐
│              API Routes (8 routes)                    │
│  Each route: validate → call lib/git.ts → respond    │
└───────────────┬───────────────────────────────────────┘
                │  function calls
                ▼
┌─────────────────────────────────────────────────────┐
│              lib/git.ts (git service)                 │
│                                                       │
│  Read operations (no branch switch):                  │
│   getCurrentBranch, getCommitsForBranch,              │
│   getCompletedStages, getNextStage,                   │
│   listPrototypeBranches, getMainCommits               │
│                                                       │
│  Write operations (stash → switch → act → restore):   │
│   createBranch, createCommit, pushBranch,             │
│   createPullRequest, syncBranch, rebaseBranch         │
│                                                       │
│  State machine logic:                                 │
│   parseStageFromMessage → getCompletedStages →        │
│   getNextStage → validate in createCommit             │
└───────────────┬───────────────────────────────────────┘
                │  execSync
                ▼
┌─────────────────────────────────────────────────────┐
│              Local Git Repository                     │
│                                                       │
│  Branches: prototype/*, integration/*, completion/*   │
│  Commits: messages prefixed with [stage-tag]          │
│  Files: prototypes/{NNN-slug}/ (side-effect output)   │
│  State: derived entirely from git log + branch list   │
└─────────────────────────────────────────────────────┘
```

**Data flow for the critical path (creating a commit):**

1. UI calls `POST /api/commit` with `{ branch: "prototype/001-auth-flow", stage: "init-folder" }`
2. Route validates input, calls `createCommit("prototype/001-auth-flow", "init-folder")`
3. `createCommit`:
   - Parses branch name → `{ type: PRO, id: 1, slug: "auth-flow" }`
   - Stashes current work, switches to branch
   - Runs `git log main..prototype/001-auth-flow` to get commits
   - Calls `getNextStage(commits)` → expects `"init-folder"` since no commits exist
   - Validates requested stage matches next allowed stage (409 if not)
   - Calls `runSideEffect("init-folder", "001-auth-flow")` → creates directory + page.tsx
   - Runs `git add prototypes/001-auth-flow`
   - Runs `git commit -m "[init-folder] Initialize prototype: 001-auth-flow"`
   - Switches back, unstashes
4. Route returns `{ ok: true, data: { hash, message, stage, date, author } }`
5. UI calls `GET /api/branches` to refresh → now shows stage 1/4 completed

### Technology Constraints

- **Next.js App Router**: API routes use `route.ts` with exported `GET`/`POST` functions and `NextRequest`/`NextResponse`
- **Server-side git**: `execSync` from `child_process` — runs in the Next.js server process
- **Client-side React**: `"use client"` page with `useState`/`useEffect`/`useCallback`
- **No external state**: No database, no Redis, no config files — git is the only persistence layer
- **Tailwind CSS**: For styling (but specific classes are incidental)

---

## 4. Reproduction Steps

**Phase 1: Types and Constants**

1. Create the type definitions file with all interfaces and constant maps — **Supporting**
   📎 `src/app/modules/git-as-state/types.ts`
   - Define `PrototypeType`, `PrototypeStage`, `STAGE_ORDER`, all request/response interfaces
   - The exact values in `STAGE_ORDER` are **Core** (the pipeline definition)
   - Color/label constants are **Incidental**

**Phase 2: Git Service Layer (the soul of the prototype)**

2. Implement the `exec()` wrapper with `execSync`, CWD, timeout, and `allowFailure` — **Core**
   📎 `src/app/modules/git-as-state/lib/git.ts#L25-L40`

3. Implement branch name encoding/parsing: `parseBranchFull()`, `nextId()`, `slugify()` — **Core**
   📎 `src/app/modules/git-as-state/lib/git.ts#L42-L91`

4. Implement the stage state machine: `parseStageFromMessage()`, `getCommitsForBranch()`, `getCompletedStages()`, `getNextStage()` — **Core**
   📎 `src/app/modules/git-as-state/lib/git.ts#L93-L189`
   - `getCommitsForBranch` MUST use `git log main..{branch}` to read only branch-specific commits
   - `parseStageFromMessage` MUST use the `[tag]` prefix convention
   - `getNextStage` MUST enforce the strict ordering defined in `STAGE_ORDER`

5. Implement stash/unstash safety pattern — **Core**
   📎 `src/app/modules/git-as-state/lib/git.ts#L119-L130`

6. Implement `listPrototypeBranches()` — scans all managed prefixes, parses metadata, computes stage state — **Core**
   📎 `src/app/modules/git-as-state/lib/git.ts#L191-L232`

7. Implement `createBranch()` — validates type, slugifies name, auto-increments ID, creates branch from main — **Core**
   📎 `src/app/modules/git-as-state/lib/git.ts#L236-L274`

8. Implement `createCommit()` — the critical function: switches branch, validates stage, runs side-effect, stages files, commits, switches back — **Core**
   📎 `src/app/modules/git-as-state/lib/git.ts#L276-L335`

9. Implement `runSideEffect()` — the stage-specific filesystem mutations — **Core** (pattern), **Incidental** (specific file contents)
   📎 `src/app/modules/git-as-state/lib/git.ts#L337-L480`

10. Implement `pushBranch()`, `createPullRequest()`, `syncBranch()` — **Core** (must exist and call git), **Supporting** (PR fallback implementation)
    📎 `src/app/modules/git-as-state/lib/git.ts#L482-L523`

11. Implement `getMainCommits()` and `rebaseBranch()` — **Core**
    📎 `src/app/modules/git-as-state/lib/git.ts#L529-L597`
    - Rebase MUST abort on conflict and leave branch unchanged

**Phase 3: API Routes**

12. Create all 8 API route files following the validate → call → respond pattern — **Core** (the routes must exist and map to the git functions), **Supporting** (exact validation messages)
    📎 `src/app/modules/git-as-state/api/*/route.ts`
    - Commit route must return 409 for stage order violations
    - Rebase route must return 409 for conflict errors

**Phase 4: Dashboard UI**

13. Create the client page that fetches branches on mount and refreshes after mutations — **Supporting**
    📎 `src/app/modules/git-as-state/page.tsx`
    - Must expose controls for ALL 8 API operations
    - Must show the stage pipeline progress visually
    - Must show commit history per branch
    - Must show branch type badge with metadata
    - Must have the rebase dropdown that fetches main commits
    - Exact component structure and styling are flexible

### What NOT to do

- **Do NOT store stage state anywhere except git commit messages.** No database, no JSON file, no in-memory cache. The state machine MUST read `git log` on every request.
- **Do NOT allow stages out of order.** The 409 response for stage violations is load-bearing — it's the enforcement mechanism.
- **Do NOT hardcode branch names.** The naming convention (`{type_prefix}/{NNN}-{slug}`) must be derived from the type system and auto-incrementing ID.
- **Do NOT skip the stash/unstash pattern.** The server may be on a different branch. Failing to stash will lose uncommitted work.
- **Do NOT make the rebase continue past conflicts.** It must abort immediately and leave the branch unchanged.
- **Do NOT scope `generic` commits to the prototype directory.** Generic commits use `git add -A` (the entire repo), while all other stages scope to `prototypes/{name}/`.
- **Do NOT make the UI static or read-only.** The human's guide hint emphasizes "how the frontend interacts with" the API — the UI must be a functional control panel, not just a display.

---

## 5. Definition of Success

**Gestalt check:** If the human saw this reproduction side-by-side with the original prototype, would they say "yes, that's the same thing"?

The reproduction should feel like a **git-powered prototype management dashboard** where every piece of state visible in the UI can be traced back to a `git log` or `git branch` command.

**Specific checks:**

1. **Stage enforcement works**: Creating a commit for `clone-reference` on a branch with no `[init-folder]` commit returns a 409 error. Stages cannot be skipped.
2. **Git is the source of truth**: If you manually run `git reset HEAD~1` on a prototype branch, the dashboard shows the branch at the previous stage on next refresh. No stale cache.
3. **Side-effects create files**: After the `init-folder` commit, `prototypes/{name}/page.tsx` exists on the branch. After `include-spec`, `spec.md` exists.
4. **Branch naming encodes metadata**: Branch names follow `{type_prefix}/{NNN}-{slug}` format. The UI shows the parsed type and ID.
5. **All 8 API operations work**: Create branch, commit (with stage validation), push, create PR (with fallback), sync, list branches, list main commits, rebase — all callable from the UI.
6. **Rebase aborts on conflict**: If a rebase encounters a merge conflict, it aborts and the branch stays exactly as it was before.
7. **Branch safety**: Mutating operations stash uncommitted changes, switch branches, operate, switch back, and unstash — the user's working tree is preserved.
8. **Commit messages use `[stage-tag]` prefix**: `git log` on a prototype branch shows messages like `[init-folder] Initialize prototype: 001-auth-flow`.
9. **Auto-incrementing IDs**: Creating multiple branches across different types assigns globally unique, incrementing IDs.
10. **The UI is a functional control panel**: Every git operation is triggerable from the dashboard, with visual feedback (toasts, progress indicators, loading states).

### What is NOT a success criterion

- **Exact visual design**: Colors, spacing, font sizes, Tailwind classes — all flexible. The UI needs to be functional and show the right information, but doesn't need to match pixel-for-pixel.
- **Specific file contents in side-effects**: The exact React component generated by `init-folder` or the exact `package.json` scaffolded by `clone-reference` don't matter. What matters is that files are created in the right location.
- **Component decomposition**: Whether the UI is one component or twenty is not critical. What matters is that all operations are exposed.
- **Error message wording**: The exact text of validation errors is flexible. The HTTP status codes (400, 409, 500) and the distinction between "stage not allowed" (409) vs "server error" (500) do matter.
- **`hasPR` detection**: This was left as `false` in the prototype — not expected to work.
- **Production-ready `clone-reference`**: The stub is explicitly accepted. No need to implement actual `create-next-app`.

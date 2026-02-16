# SPEC: Automated Prototype Pipeline — Git + Prompt Generation + Claude SDK

**Combines:**
- `src/app/modules/reverse-git/SPEC.md` — git-as-state (stage pipeline, branch safety, commit enforcement)
- `src/app/modules/script-generator-reverse/SPEC.md` — spec generator (template loading, placeholder substitution, prompt output)

**Scope:** New feature — an end-to-end automated prototype pipeline
**Essence:** A git commit pipeline where each stage doesn't just mutate the filesystem — it generates prompts, feeds them to the Claude Code SDK to write specs, submits implementation jobs to a worker queue, and manages the full lifecycle from "new prototype" to "PR ready for review." Git remains the sole source of truth for pipeline state.

---

## 1. Purpose (WHAT)

The two existing prototypes each solve half the problem:

- **Git-as-state** gives us an enforced commit pipeline where git commit history IS the state machine. Branches represent prototypes, commit messages encode stage progression, and skipping stages returns a 409.
- **Script generator** gives us template-based prompt generation — read a markdown template, substitute `{{PLACEHOLDERS}}`, get a prompt ready to feed to an AI.

This feature **fuses them**: the commit pipeline's side-effects aren't just "create a folder" or "write a marker file" — they're **"generate a prompt and feed it to Claude Code SDK to write a spec"** and **"generate an implementation prompt and submit it to a worker queue."**

### How it works (walkthrough)

1. Developer visits the dashboard at `/modules/crazy-reverse-fwd`
2. Clicks "New Prototype", enters a name like `auth-flow`
3. **Selects a source-of-truth module** from a dropdown (e.g. `src/app/modules/script-generator/`)
4. If the source module has a `SPEC.md`, a **mode selector** appears:
   - **Forwards Only** — copy that spec directly, skip spec generation, go straight to implementation (4 stages)
   - **Reverse + Forwards** — copy spec as `spec-parent.md`, record parent-child lineage, then generate a new spec (5 stages)
5. Clicks "Create Branch" → system creates branch `prototype/auth-flow` **and auto-runs init** — creates module dir, writes `pipeline.json` with mode + source info, copies spec files per mode, writes placeholder `page.tsx` → auto-commits `[init] Initialize module (forwards-only): auth-flow`
6. Branch card appears with init already complete. The next step depends on the mode:
   - **Forwards Only**: next step is `implementation-started` (spec was already copied during init)
   - **Reverse + Forwards**: next step is `generate-spec`
7. **Generate Spec (reverse-and-forwards only):** Click "Generate Spec" → system kicks off Claude SDK **in the background** (returns immediately, polls every 5s) → Claude reads `pipeline.json` for source path, generates spec prompt, writes `SPEC.md` → once detected as complete, auto-commits `[generate-spec] Spec generated for: auth-flow`
8. **Submit Implementation:** System reads the `implement.md` template, substitutes `{{WORKING_DIR}}` with the new module path (which now contains the spec) → submits the generated implementation prompt to the mock worker queue → auto-commits `[implementation-started] Job submitted for: auth-flow`
9. **Implementation Complete:** Worker finishes (mocked) → the system is notified → auto-commits `[implementation-complete] Ready for review: auth-flow`
10. **Push & PR:** Click "Push for Review" → pushes branch to origin → creates GitHub PR via `gh pr create` (with URL fallback) → pipeline done

At every point, the dashboard shows real-time pipeline progress derived from `git log`. Reset a commit? The stage reverts. The only source of truth is git.

### What's new vs. the parent prototypes

| Concern | Git-as-state (parent) | Script generator (parent) | This feature (combined) |
|---------|----------------------|--------------------------|------------------------|
| Branch naming | `{type}/{NNN}-{slug}` | N/A | `prototype/{slug}` (simplified) |
| Stage side-effects | Create folders, write markers | N/A | Generate prompts, invoke Claude SDK, submit to queue |
| Prompt generation | N/A | Template substitution, display in UI | Template substitution as pipeline stage input |
| AI invocation | N/A | Manual copy-paste to Claude | Automated via `@anthropic-ai/claude-agent-sdk` |
| Worker queue | N/A | N/A | Mock queue (JSON file) for implementation jobs |
| End state | Free-form generic commits | Display prompt | PR created on GitHub |

### Scope boundaries

- **Worker queue is mocked.** Use a JSON file at `script/spec-gen-kit/output/queue.json` with append semantics. Console.log as backup. The real queue integration comes later.
- **Claude SDK calls are real but budget-capped.** Set `maxBudgetUsd` and `maxTurns` on every SDK call to prevent runaway costs.
- **Templates are reused + extended.** Existing templates at `script/spec-gen-kit/templates/` are consumed. New templates specific to this pipeline may be added alongside them.
- **No type system for branches.** Unlike git-as-state's `PRO/INT/COM` types, all branches use `prototype/{slug}`. Simpler.
- **No rebase/sync features.** Focus is on the forward pipeline. Push and PR are the only git remote operations.
- **No authentication.** Local developer tool.

---

## 2. Full Map (HOW)

### 2.1 Pipeline Modes and Stage Definitions — Core

The pipeline supports **two modes** that determine the stage order:

**`PipelineMode = 'forwards-only' | 'reverse-and-forwards'`**

**Forwards Only** — 4 stages (source spec is copied directly during init, no generation needed):

| # | Stage Tag | Commit Prefix | Side-Effect |
|---|-----------|--------------|-------------|
| 1 | `init` | `[init]` | Create module folder + `pipeline.json` + copy source SPEC.md + placeholder `page.tsx` |
| 2 | `implementation-started` | `[implementation-started]` | Generate implement prompt → submit to mock queue |
| 3 | `implementation-complete` | `[implementation-complete]` | Write `.complete` marker |
| 4 | `push-for-review` | `[push-for-review]` | Push branch + create PR |

**Reverse + Forwards** — 5 stages (source spec is copied as `spec-parent.md`, new spec is generated):

| # | Stage Tag | Commit Prefix | Side-Effect |
|---|-----------|--------------|-------------|
| 1 | `init` | `[init]` | Create module folder + `pipeline.json` + copy source SPEC.md as `spec-parent.md` + write `lineage.json` + placeholder `page.tsx` |
| 2 | `generate-spec` | `[generate-spec]` | Generate spec prompt → invoke Claude SDK (async) → write SPEC.md |
| 3 | `implementation-started` | `[implementation-started]` | Generate implement prompt → submit to mock queue |
| 4 | `implementation-complete` | `[implementation-complete]` | Write `.complete` marker |
| 5 | `push-for-review` | `[push-for-review]` | Push branch + create PR |

**Stage enforcement** uses the same state machine pattern from the git-as-state parent, but `getNextStage()` accepts an optional `mode` parameter to select the correct stage order array.

> 📎 **See `reverse-git/SPEC.md` §2.1** for the full stage state machine pattern. The only difference: there are now two `STAGE_ORDER` arrays instead of one, and `getNextStage(commits, mode?)` picks the right one.

### 2.2 Pipeline Metadata — Core

**`pipeline.json`** is written into the module directory during init and committed to the prototype branch. It stores mode + source module info:

```json
{
  "mode": "forwards-only",
  "sourceModule": {
    "name": "script-generator",
    "path": "src/app/modules/script-generator",
    "hasSpec": true
  },
  "createdAt": "2026-02-16T..."
}
```

**Reading across branches:** Since `pipeline.json` lives on prototype branches (not main), we use `git show {branch}:{path}/pipeline.json` to read it without checkout. This is used by `listPrototypeBranches()` and `getNextStage()`.

**`lineage.json`** (reverse-and-forwards mode only) records parent-child spec relationships:

```json
{
  "parentSpec": "src/app/modules/script-generator/SPEC.md",
  "parentModule": "src/app/modules/script-generator",
  "childSpec": "src/app/modules/auth-flow/SPEC.md",
  "createdAt": "2026-02-16T..."
}
```

These files **replace `reference.json`** from the original design. The `set-reference` stage no longer exists — source selection happens upfront during branch creation.

### 2.3 Branch Naming — Core

Simplified from git-as-state. No type system, no auto-incrementing ID.

**Format:** `prototype/{slug}`

- `slug` is the user-provided name, slugified (lowercase, spaces to hyphens, strip non-alphanumeric except hyphens)
- Example: user enters "Auth Flow" → branch `prototype/auth-flow`
- `parseBranch(branchName)` extracts the slug from `prototype/{slug}`
- Module folder derived from slug: `src/app/modules/{slug}/`

> 📎 **See `reverse-git/SPEC.md` §2.3** for the branch naming convention pattern this simplifies.

### 2.4 Branch Creation + Auto-Init — Core

Branch creation is no longer just `git branch`. It's a single operation that:

1. Validates the source module path exists and is a directory
2. Determines if source has a `SPEC.md`
3. Creates the git branch from main
4. **Auto-runs the init commit** (via `addCommit()`) which:
   - Creates the module directory + placeholder `page.tsx`
   - Writes `pipeline.json` with mode + source module info
   - **Forwards-only + source has spec:** copies source `SPEC.md` → module's `SPEC.md`
   - **Reverse-and-forwards + source has spec:** copies source `SPEC.md` → `spec-parent.md`, writes `lineage.json`
5. Returns the branch with init already complete

**API:** `POST /api/create-branch` now requires `{ name, sourceModulePath, mode }`.

### 2.5 The `addCommit` Method — Core

Same heart of the system as before. Reads `pipeline.json` from the branch (via `git show`) to determine mode for stage validation.

```
addCommit(branchName, stage, options?) → CommitResult
```

**Sequence:**

1. Parse branch name → derive `slug` and `modulePath`
2. Stash current work, switch to branch
3. Read `pipeline.json` via `git show` to get mode
4. Read `git log main..{branch}` → parse completed stages
5. Validate: `getNextStage(completedStages, mode) === requestedStage` → 409 if not
6. Execute stage-specific side-effect
7. `git add` the affected files
8. `git commit -m "[{stage}] {description}"`
9. Switch back to previous branch, unstash
10. Return `{ hash, message, stage, date }`

> 📎 **See `reverse-git/SPEC.md` §2.4 (stash/unstash)** for the safety patterns reused here.

### 2.6 Stage Side-Effects — Core

**Stage: `init`**
- Create directory `src/app/modules/{slug}/`
- Write placeholder `page.tsx`
- Write `pipeline.json` (mode, source module info, timestamp)
- If forwards-only + source has spec: copy source SPEC.md → SPEC.md
- If reverse-and-forwards + source has spec: copy source SPEC.md → `spec-parent.md`, write `lineage.json`

**Stage: `generate-spec`** (reverse-and-forwards only)
- **Async execution** via dedicated `/api/generate-spec/start` and `/api/generate-spec/status` endpoints (see §2.8)
- Reads `pipeline.json` (via `git show`, no checkout) to get source-of-truth path
- Generates the spec prompt using the template engine (template: `spec-gen-only.md`)
- Substitutions:
  - `{{WORKING_DIR}}` → source module path
  - `{{CONVERSATION_DIR}}` → user-provided (optional, defaults to empty string)
  - `{{GUIDE_HINT}}` → user-provided (optional, defaults to empty string)
- Ensures module dir exists on disk, starts Claude SDK **in background** (fire-and-forget)
- UI polls `/api/generate-spec/status` every 5s
- When Claude completes and SPEC.md exists, UI auto-calls `POST /api/commit { stage: "generate-spec" }`
- The commit side-effect detects that SPEC.md already exists and **skips the SDK call** — just stages and commits

**Stage: `implementation-started`**
- Generates implementation prompt using template (`implement.md`)
- Substitutes `{{WORKING_DIR}}` → `src/app/modules/{slug}/`
- Writes prompt to `script/spec-gen-kit/output/implement-prompt.md`
- Submits to mock worker queue (see §2.9)
- Writes `.implementation-started` marker with job ID

**Stage: `implementation-complete`**
- Reads `.implementation-started` marker to get job ID
- Updates job in `queue.json` to status `"complete"`
- Writes `.complete` marker

**Stage: `push-for-review`**
- `git push -u origin {branchName}`
- Create PR via `gh pr create` with fallback to comparison URL
- Terminal stage

### 2.7 Claude Code SDK Integration — Core

**Package:** `@anthropic-ai/claude-agent-sdk`

The SDK call is now **asynchronous**: it runs in the background via a fire-and-forget promise, tracked by an in-memory `Map<branch, SpecTask>` in `lib/spec-task.ts`.

**Key SDK configuration:**

| Option | Value | Why |
|--------|-------|-----|
| `cwd` | `src/app/modules/{slug}/` | Claude writes SPEC.md here |
| `model` | `"sonnet"` | Good balance of speed and quality |
| `allowedTools` | `["Read", "Glob", "Grep", "Write", "Edit"]` | Needs to read reference code and write spec |
| `maxTurns` | `100` | Spec writing may require many reads |
| `maxBudgetUsd` | `1.00` | Cap cost per spec generation |
| `permissionMode` | `"bypassPermissions"` | Server-side, no human in the loop |

**Error handling:**
- If the SDK call fails, the in-memory task is marked `failed` with the error message
- The UI shows the error in a toast when polling detects it
- The branch stays at the previous stage (no commit was created)

### 2.8 API Routes — Core

Nine Next.js App Router API routes:

| Route | Method | Purpose | Request Body | Response |
|-------|--------|---------|-------------|----------|
| `api/branches` | `GET` | List all `prototype/*` branches with stage state + mode | — | `PrototypeBranch[]` |
| `api/create-branch` | `POST` | Create branch + auto-init | `{ name, sourceModulePath, mode }` | `PrototypeBranch` |
| `api/commit` | `POST` | Execute stage side-effect + commit | `{ branch, stage, ...stageOptions }` | `CommitResult` |
| `api/generate-spec/start` | `POST` | Start async spec generation | `{ branch, conversationDir?, guideHint? }` | `{ status }` |
| `api/generate-spec/status` | `GET` | Poll spec generation status | `?branch=prototype/slug` | `SpecTask \| null` |
| `api/modules` | `GET` | List existing modules | `?root=src/app/modules` | `ModuleInfo[]` |
| `api/push` | `POST` | Push branch to origin | `{ branch }` | `{ output }` |
| `api/create-pr` | `POST` | Create GitHub PR | `{ branch, title, body? }` | `{ url, stubbed }` |
| `api/queue` | `GET` | List jobs in mock queue | — | `QueueJob[]` |

**The `api/commit` route** accepts stage-specific options:
- Stage `generate-spec`: `{ branch, stage }` — no extra input needed (SDK already ran)
- Stage `implementation-started`: `{ branch, stage }` — no extra input
- Stage `implementation-complete`: `{ branch, stage }` — marks job done
- Stage `push-for-review`: `{ branch, stage, prTitle? }` — optional PR title override

### 2.9 Mock Worker Queue — Supporting

**New to this feature.** A simple JSON-file-based job queue at `script/spec-gen-kit/output/queue.json`.

**Schema:**
```typescript
interface QueueJob {
  id: string;              // UUID
  branch: string;          // prototype/{slug}
  modulePath: string;      // src/app/modules/{slug}/
  prompt: string;          // the generated implementation prompt
  status: "pending" | "running" | "complete" | "failed";
  submittedAt: string;     // ISO timestamp
  completedAt?: string;    // ISO timestamp
}
```

**Operations:**
- `appendToQueue(job)` — read file, parse, push, write back (or create if not exists)
- `updateJobStatus(jobId, status)` — find by ID, update status, write back
- `getJob(jobId)` — read and return

This is intentionally simple. The real worker queue integration replaces these functions later.

### 2.10 Dashboard UI — Supporting

A `"use client"` page with the same single-file pattern as the parents.

**What's unique to this UI:**

1. **Branch creation form** — name input + **source module picker** + **mode selector** (shown when source has a spec). Two toggle buttons: "Forwards Only" / "Reverse + Forwards". Create button requires both name and source module.
2. **Dynamic stage progress** — `StageProgress` accepts a `stageOrder` prop (4 or 5 stages depending on mode). Each branch card derives its stage order from `branch.mode`.
3. **Mode badge** — each branch card shows "FWD" (sky blue) or "REV+FWD" (violet) badge in the header.
4. **No init or set-reference UI** — both happen automatically during creation.
5. **Next step panel** renders stage-specific forms:
   - `generate-spec`: Conversation directory input (optional) + guide hint textarea (optional) + "Generate Spec" button. Runs async — shows spinner with elapsed seconds, polls every 5s, auto-commits when done.
   - `implementation-started`: "Submit to Queue" button
   - `implementation-complete`: "Mark Complete" button
   - `push-for-review`: PR title input (pre-filled) + "Push & Create PR" button
6. **Queue panel** — shows mock queue status
7. **Mode-aware legend** — pipeline stages reference shows both modes separately

### 2.11 Type Definitions — Supporting

```typescript
type PipelineMode = 'forwards-only' | 'reverse-and-forwards';

type PipelineStage =
  | "init"
  | "generate-spec"
  | "implementation-started"
  | "implementation-complete"
  | "push-for-review";

const STAGE_ORDER_FORWARDS: PipelineStage[] = [
  "init",
  "implementation-started",
  "implementation-complete",
  "push-for-review",
];

const STAGE_ORDER_REVERSE: PipelineStage[] = [
  "init",
  "generate-spec",
  "implementation-started",
  "implementation-complete",
  "push-for-review",
];

function getStageOrderForMode(mode: PipelineMode): PipelineStage[] {
  return mode === 'forwards-only' ? STAGE_ORDER_FORWARDS : STAGE_ORDER_REVERSE;
}

interface PipelineMeta {
  mode: PipelineMode;
  sourceModule: { name: string; path: string; hasSpec: boolean };
  createdAt: string;
}

interface LineageInfo {
  parentSpec: string;
  parentModule: string;
  childSpec: string;
  createdAt: string;
}

interface PrototypeBranch {
  name: string;
  slug: string;
  modulePath: string;
  commits: PrototypeCommit[];
  completedStages: PipelineStage[];
  nextStage: PipelineStage | null;
  stageCount: number;       // 4 or 5 depending on mode
  mode?: PipelineMode;
  pipelineMeta?: PipelineMeta;
}

interface CommitRequest {
  branch: string;
  stage: PipelineStage;
  conversationDir?: string;  // for generate-spec (optional)
  guideHint?: string;        // for generate-spec (optional)
  prTitle?: string;          // for push-for-review
}

interface CreateBranchRequest {
  name: string;
  sourceModulePath: string;
  mode: PipelineMode;
}
```

---

## 3. How the Parts Connect

```
┌──────────────────────────────────────────────────────────┐
│                    page.tsx (Dashboard UI)                 │
│                                                           │
│  CrazyReverseFwdPage                                      │
│   ├── Create form → POST /api/create-branch               │
│   │    ├── Name input                                     │
│   │    ├── Source module picker                            │
│   │    └── Mode selector (FWD / REV+FWD)                  │
│   └── BranchCard[] (one per prototype branch)             │
│        ├── Mode badge (FWD / REV+FWD)                     │
│        ├── StageProgress (dynamic: 4 or 5 stages)         │
│        ├── CommitTimeline                                  │
│        └── NextStepPanel (stage-specific UI + submit)     │
│             ├── [generate-spec] → async: start + poll     │
│             ├── [impl-started] → "Submit Job" button       │
│             ├── [impl-complete] → "Mark Complete" button   │
│             └── [push-for-review] → PR title + push button │
│                                                           │
│  On mount: GET /api/branches → setBranches()              │
│  After any mutation: GET /api/branches (refresh)          │
└─────────────────┬─────────────────────────────────────────┘
                  │ fetch (JSON)
                  ▼
┌──────────────────────────────────────────────────────────┐
│              API Routes (9 routes)                         │
│  Pattern: validate → call lib → ApiResponse<T>            │
│                                                           │
│  api/create-branch: validates name + sourceModulePath +   │
│    mode, calls createBranch() which auto-runs init        │
│  api/commit: validates stage against both stage orders    │
│  api/generate-spec/start: kicks off Claude SDK in bg      │
│  api/generate-spec/status: polls in-memory task status    │
└─────────────────┬─────────────────────────────────────────┘
                  │ function calls
                  ▼
┌──────────────────────────────────────────────────────────┐
│              lib/pipeline.ts (pipeline service)            │
│                                                           │
│  CORE FUNCTIONS:                                          │
│   readPipelineMetaFromBranch() — git show, no checkout    │
│   getNextStage(commits, mode?) — mode-aware stage order   │
│   createBranch(name, sourcePath, mode) — auto-runs init   │
│   addCommit() — unified commit function                   │
│   runSideEffect() — stage dispatch:                       │
│     ├── init: mkdir + pipeline.json + spec copy + page.tsx│
│     ├── generate-spec: skip if SPEC.md exists, else SDK   │
│     ├── impl-started: template → queue.json               │
│     ├── impl-complete: write .complete marker             │
│     └── push-for-review: git push + gh pr create          │
│                                                           │
│  lib/spec-task.ts — in-memory Map<branch, SpecTask>       │
│   startSpecTask(), completeSpecTask(), failSpecTask()     │
│   getSpecTask() — used by status polling endpoint         │
│                                                           │
│  lib/claude-sdk.ts — generateSpecWithClaude()             │
│  lib/queue.ts — appendToQueue(), updateJobStatus()        │
│  lib/templates.ts — readTemplate(), substituteTemplate()  │
└─────────────────┬─────────────────────────────────────────┘
                  │ execSync / fs / Claude SDK
                  ▼
┌──────────────────────────────────────────────────────────┐
│  Local git repo          Template files          Queue    │
│  - branches              - spec-gen-only.md      - JSON   │
│  - commits               - implement.md          - file   │
│  - pipeline.json                                          │
│  - lineage.json                                           │
│                                                           │
│  Claude Code SDK (@anthropic-ai/claude-agent-sdk)         │
│  - Reads reference module code                            │
│  - Writes SPEC.md to module folder                        │
└──────────────────────────────────────────────────────────┘
```

### Critical Data Flow: Generate Spec (async, reverse-and-forwards only)

```
User clicks "Generate Spec"
  with optional conversationDir + guideHint
        │
        ▼
POST /api/generate-spec/start { branch, conversationDir?, guideHint? }
        │
        ├── 1. Validate stage order (generate-spec must be next)
        ├── 2. Read pipeline.json via git show (no checkout)
        ├── 3. Generate prompt from spec-gen-only.md template
        ├── 4. Ensure module dir exists on disk (mkdir -p)
        ├── 5. Start Claude SDK in background (fire-and-forget promise)
        └── 6. Return immediately: { status: "started" }

UI polls GET /api/generate-spec/status?branch=prototype/auth-flow
  every 5 seconds
        │
        ▼ (when task.status === "complete")
        │
POST /api/commit { branch, stage: "generate-spec" }
        │
        ├── addCommit() checks out branch
        ├── runSideEffect("generate-spec") detects SPEC.md exists → skips SDK
        ├── git add + git commit
        └── Returns commit result
```

### Critical Data Flow: Submit Implementation

```
User clicks "Submit to Queue"
        │
        ▼
POST /api/commit { branch, stage: "implementation-started" }
        │
        ▼
addCommit() validates stage order (mode-aware)
        │
        ▼
runSideEffect("implementation-started", modulePath, {})
        │
        ├── 1. Read implement.md template
        ├── 2. Substitute: {{WORKING_DIR}} → src/app/modules/auth-flow/
        ├── 3. Write prompt to script/spec-gen-kit/output/
        ├── 4. Create queue job → append to queue.json
        ├── 5. Write .implementation-started marker with job ID
        └── 6. git add + git commit
```

---

## 4. Reproduction Steps

**Phase 1: Types**

1. Create `types.ts` with `PipelineMode`, `PipelineStage`, `STAGE_ORDER_FORWARDS`, `STAGE_ORDER_REVERSE`, `getStageOrderForMode()`, `PipelineMeta`, `LineageInfo`, `PrototypeBranch`, `CommitRequest`, `CreateBranchRequest`, `QueueJob`, `ApiResponse<T>` — **Core**

**Phase 2: Lib (pipeline service)**

2. Create `lib/pipeline.ts`:
   - `readPipelineMetaFromBranch()` — reads `pipeline.json` via `git show` — **Core**
   - `getNextStage(commits, mode?)` — mode-aware stage order lookup — **Core**
   - `createBranch(name, sourceModulePath, mode)` — validates source, creates branch, auto-runs init — **Core**
   - `addCommit()` — reads mode from pipeline.json for stage validation — **Core**
   - `runSideEffect()` — stage dispatch for 5 stages (no set-reference) — **Core**
   - `pushBranch()`, `createPullRequest()` — **Supporting**

3. Create `lib/templates.ts` — reuse template engine — **Core**

4. Create `lib/queue.ts` — mock worker queue — **Supporting**

5. Create `lib/claude-sdk.ts` — Claude Code SDK wrapper — **Core**

6. Create `lib/spec-task.ts` — in-memory task tracker for async spec generation — **Core**

**Phase 3: API Routes**

7-15. Create the 9 API routes — **Core** (branches, create-branch, commit, generate-spec/start, generate-spec/status) / **Supporting** (modules, push, create-pr, queue)

**Phase 4: Dashboard UI**

16. Create `page.tsx`:
    - Create form with source module picker + mode selector
    - Dynamic stage progress (4 or 5 stages per mode)
    - Mode badge on branch cards (FWD / REV+FWD)
    - Async generate-spec with polling
    - No init or set-reference UI panels

### What NOT to do

- **Do NOT store pipeline state outside of git.** (Same rule as `reverse-git/SPEC.md` §4)
- **Do NOT skip the stash/unstash pattern.** (Same rule as `reverse-git/SPEC.md` §4)
- **Do NOT inline template content or use regex for substitution.** (Same rules as `script-generator-reverse/SPEC.md` §4)
- **Do NOT let Claude SDK calls run unbounded.** Always set `maxBudgetUsd` and `maxTurns`.
- **Do NOT implement a real worker queue.** Mock it with JSON file operations.
- **Do NOT add rebase, sync, or branch type features.** Keep the pipeline focused and forward-only.
- **Do NOT split the page into multiple component files.** Keep everything in one `page.tsx`.
- **Do NOT await the Claude SDK call inside the API route.** Use async background execution with polling.

---

## 5. Definition of Success

**Gestalt check:** A developer opens the dashboard, creates a prototype named "auth-flow" with a source module and chosen mode. The branch appears with init already done. Depending on mode, they either go straight to implementation (forwards-only, 4 stages) or generate a new spec first (reverse-and-forwards, 5 stages). Spec generation runs in the background without blocking the page. By the end, there's a git branch with stage-tagged commits, the right spec files, an implementation prompt in the mock queue, and a PR on GitHub. All state visible in the UI was derived from `git log` + `pipeline.json`.

**Specific checks:**

1. **Mode-aware stage enforcement works** — Forwards-only branch skips `generate-spec`. Reverse-and-forwards requires it. Attempting wrong stage returns 409.
2. **Git is the source of truth** — `git reset HEAD~1` on a prototype branch → dashboard shows previous stage on refresh.
3. **CWD derivation works** — Branch `prototype/auth-flow` → all side-effects operate in `src/app/modules/auth-flow/`.
4. **Source module is recorded in pipeline.json** — After init, `pipeline.json` exists with mode + source module info. Readable via `git show` from any branch.
5. **Forwards-only copies spec directly** — After init on a forwards-only branch, `SPEC.md` exists in the module folder (copied from source).
6. **Reverse-and-forwards records lineage** — After init, `spec-parent.md` and `lineage.json` exist in the module folder.
7. **Async spec generation works** — Clicking "Generate Spec" returns immediately, polls every 5s, auto-commits when done. No page refresh.
8. **Conversation dir and guide hint are optional** — Generate spec works with empty/missing values for both.
9. **Implementation job is queued** — After `implementation-started`, `queue.json` contains a job entry.
10. **Push and PR work** — The final stage pushes and creates a PR.
11. **All 9 API routes return the `{ok, data}/{ok, error}` envelope.**
12. **Module picker shows `(has SPEC)` badges.** Mode selector appears only when source has a spec.

### What is NOT a success criterion

- **Exact styling or colors** — Any clean, functional dark-themed dashboard works.
- **Real worker queue integration** — The mock (JSON file) is sufficient.
- **Streaming Claude SDK output to the UI** — A polling spinner with elapsed time is enough.
- **Pixel-perfect component layout** — Functional and clear beats pretty.
- **Cost optimization of Claude SDK calls** — The budget cap is enough for now.

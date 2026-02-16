"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiResponse,
  ManifestEntry,
  OverlayItem,
  PipelineStage,
  PrototypeBranch,
  PrototypeCommit,
  QueueJob,
} from "../pipeline-types";
import {
  STAGE_DESCRIPTIONS,
  STAGE_LABELS,
  getStageOrderForMode,
} from "../pipeline-types";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = "/modules/final/api";

async function apiFetch<T>(
  path: string,
  opts?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}

async function fetchBranches() {
  return apiFetch<PrototypeBranch[]>("/branches");
}

async function apiCommit(
  branch: string,
  stage: PipelineStage,
  extra?: { prTitle?: string }
) {
  return apiFetch<PrototypeCommit>("/commit", {
    method: "POST",
    body: JSON.stringify({ branch, stage, ...extra }),
  });
}

async function apiPush(branch: string) {
  return apiFetch<{ output: string }>("/push", {
    method: "POST",
    body: JSON.stringify({ branch }),
  });
}

async function apiCreatePR(branch: string, title: string, body?: string) {
  return apiFetch<{ url: string; stubbed: boolean }>("/create-pr", {
    method: "POST",
    body: JSON.stringify({ branch, title, body }),
  });
}

async function fetchQueue() {
  return apiFetch<QueueJob[]>("/queue");
}

async function apiStartSpecGen(branch: string) {
  return apiFetch<{ status: string }>("/generate-spec/start", {
    method: "POST",
    body: JSON.stringify({ branch }),
  });
}

interface SpecGenStatus {
  completedStages: PipelineStage[];
  nextStage: PipelineStage | null;
  specFileExists: boolean;
}

async function apiSpecGenStatus(branch: string): Promise<ApiResponse<SpecGenStatus>> {
  return apiFetch<SpecGenStatus>(
    `/generate-spec/status?branch=${encodeURIComponent(branch)}`
  );
}

async function apiImportOverlay(items: OverlayItem[]) {
  return apiFetch<ManifestEntry[]>("/import-overlay", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

async function apiSaveManifest(entries: ManifestEntry[]) {
  return apiFetch<{
    manifest: { createdAt: string; entries: ManifestEntry[] };
    branches: PrototypeBranch[];
  }>("/save-manifest", {
    method: "POST",
    body: JSON.stringify({ entries }),
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

// ---------------------------------------------------------------------------
// Stage progress
// ---------------------------------------------------------------------------

function StageProgress({
  completedStages,
  nextStage,
  stageOrder,
}: {
  completedStages: PipelineStage[];
  nextStage: PipelineStage | null;
  stageOrder: PipelineStage[];
}) {
  return (
    <div className="flex items-center gap-1">
      {stageOrder.map((stage, i) => {
        const done = completedStages.includes(stage);
        const isNext = stage === nextStage;
        return (
          <div key={stage} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`h-0.5 w-3 sm:w-5 ${done ? "bg-emerald-500" : "bg-zinc-700"}`}
              />
            )}
            <div className="group relative">
              <div
                className={`h-3 w-3 rounded-full border-2 transition-all ${done
                  ? "border-emerald-500 bg-emerald-500"
                  : isNext
                    ? "border-indigo-400 bg-indigo-400/20 animate-pulse"
                    : "border-zinc-600 bg-transparent"
                  }`}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[10px] leading-tight bg-zinc-800 text-zinc-200 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {STAGE_LABELS[stage]}
                {done && " \u2713"}
                {isNext && " (next)"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commit timeline
// ---------------------------------------------------------------------------

function CommitTimeline({ commits }: { commits: PrototypeCommit[] }) {
  if (commits.length === 0) {
    return <p className="text-xs text-zinc-500 italic">No commits yet</p>;
  }
  return (
    <div className="space-y-1.5">
      {commits.map((c, i) => (
        <div key={c.hash} className="flex items-start gap-2 text-xs">
          <div className="flex flex-col items-center mt-1">
            <div
              className={`h-2 w-2 rounded-full ${c.stage ? "bg-emerald-500" : "bg-zinc-500"}`}
            />
            {i < commits.length - 1 && (
              <div className="h-4 w-px bg-zinc-700 mt-0.5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-200 truncate font-mono text-[11px]">
              {c.message}
            </p>
            <p className="text-zinc-500 text-[10px]">
              {c.hash.slice(0, 7)} &middot; {formatDate(c.date)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next-step panel
// ---------------------------------------------------------------------------

function NextStepPanel({
  branch,
  nextStage,
  loading,
  onExecute,
  onFlash,
  onRefresh,
}: {
  branch: PrototypeBranch;
  nextStage: PipelineStage;
  loading: boolean;
  onExecute: (stage: PipelineStage, extra?: Record<string, string>) => void;
  onFlash: (msg: string, type: "ok" | "err") => void;
  onRefresh: () => void;
}) {
  const [prTitle, setPrTitle] = useState(`Prototype: ${branch.slug}`);
  const [specGenRunning, setSpecGenRunning] = useState(false);
  const [specGenElapsed, setSpecGenElapsed] = useState(0);
  const [specGenFailed, setSpecGenFailed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-start polling if branch is at prompt-ready and next is generate-spec
  // (page reload recovery: detect that SDK should be running)
  useEffect(() => {
    if (
      nextStage === "generate-spec" &&
      branch.completedStages.includes("prompt-ready") &&
      !specGenRunning &&
      !specGenFailed
    ) {
      // Compute elapsed from the prompt-ready commit date
      const promptCommit = branch.commits.find((c) => c.stage === "prompt-ready");
      if (promptCommit) {
        const elapsed = Math.floor(
          (Date.now() - new Date(promptCommit.date).getTime()) / 1000
        );
        setSpecGenElapsed(elapsed);
      }
      startPolling();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextStage]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSpecGenRunning(false);
  }

  function startPolling() {
    setSpecGenRunning(true);
    setSpecGenFailed(false);

    timerRef.current = setInterval(() => {
      setSpecGenElapsed((s) => s + 1);
    }, 1000);

    pollRef.current = setInterval(async () => {
      const statusRes = await apiSpecGenStatus(branch.name);
      if (!statusRes.ok || !statusRes.data) return;

      const status = statusRes.data;

      // generate-spec committed — done!
      if (status.completedStages.includes("generate-spec")) {
        stopPolling();
        onFlash("Extraction spec generated and committed", "ok");
        onRefresh();
        return;
      }

      // SPEC.md exists on disk but not yet committed — SDK may have just finished
      // Keep polling; the server async handler will commit it shortly
    }, 5000);
  }

  async function handleStartSpecGen() {
    setSpecGenRunning(true);
    setSpecGenElapsed(0);
    setSpecGenFailed(false);

    const res = await apiStartSpecGen(branch.name);

    if (!res.ok) {
      onFlash(res.error || "Failed to start spec generation", "err");
      stopPolling();
      setSpecGenFailed(true);
      return;
    }

    startPolling();
  }

  async function handleRetry() {
    setSpecGenFailed(false);
    setSpecGenElapsed(0);
    setSpecGenRunning(true);

    const res = await apiStartSpecGen(branch.name);

    if (!res.ok) {
      onFlash(res.error || "Failed to retry spec generation", "err");
      stopPolling();
      setSpecGenFailed(true);
      return;
    }

    startPolling();
  }

  // prompt-ready is next: show button to generate extraction spec
  if (nextStage === "prompt-ready") {
    return (
      <div className="space-y-3">
        <button
          onClick={handleStartSpecGen}
          disabled={specGenRunning}
          className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50 transition-colors"
        >
          {specGenRunning ? "Starting..." : "Generate Extraction Spec"}
        </button>
      </div>
    );
  }

  // generate-spec is next: prompt-ready is done, SDK should be running
  if (nextStage === "generate-spec") {
    return (
      <div className="space-y-3">
        {specGenRunning && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-purple-400">
              <div className="h-3 w-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span>
                Claude is writing extraction SPEC.md... ({specGenElapsed}s
                elapsed)
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Polling git state every 5s. Will detect commit automatically.
            </p>
          </div>
        )}

        {!specGenRunning && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">
              Branch is at <code className="text-purple-400">prompt-ready</code>. SDK may have failed or timed out.
            </p>
            <button
              onClick={handleRetry}
              className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 transition-colors"
            >
              Retry Spec Generation
            </button>
          </div>
        )}
      </div>
    );
  }

  if (nextStage === "implementation-started") {
    return (
      <button
        onClick={() => onExecute("implementation-started")}
        disabled={loading}
        className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
      >
        {loading ? "Submitting to queue..." : "Submit to Queue"}
      </button>
    );
  }

  if (nextStage === "implementation-complete") {
    return (
      <button
        onClick={() => onExecute("implementation-complete")}
        disabled={loading}
        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
      >
        {loading ? "Marking complete..." : "Mark Complete"}
      </button>
    );
  }

  if (nextStage === "push-for-review") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="block text-xs text-zinc-400">PR Title</label>
          <input
            type="text"
            value={prTitle}
            onChange={(e) => setPrTitle(e.target.value)}
            className="w-full rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button
          onClick={() =>
            prTitle.trim() &&
            onExecute("push-for-review", { prTitle: prTitle.trim() })
          }
          disabled={loading || !prTitle.trim()}
          className="rounded bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
        >
          {loading ? "Pushing..." : "Push & Create PR"}
        </button>
      </div>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Branch card
// ---------------------------------------------------------------------------

function BranchCard({
  branch,
  onRefresh,
}: {
  branch: PrototypeBranch;
  onRefresh: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);

  const mode = branch.mode || "reverse-and-forwards";
  const stageOrder = getStageOrderForMode(mode);

  function flash(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleCommit(
    stage: PipelineStage,
    extra?: Record<string, string>
  ) {
    setActionLoading("commit");
    const res = await apiCommit(branch.name, stage, extra);
    setActionLoading(null);
    if (res.ok) {
      flash(`Committed: ${res.data?.message}`, "ok");
      onRefresh();
    } else {
      flash(res.error || "Commit failed", "err");
    }
  }

  async function handlePushAndPR(
    stage: PipelineStage,
    extra?: Record<string, string>
  ) {
    setActionLoading("commit");

    const commitRes = await apiCommit(branch.name, stage, extra);
    if (!commitRes.ok) {
      setActionLoading(null);
      flash(commitRes.error || "Commit failed", "err");
      return;
    }

    const pushRes = await apiPush(branch.name);
    if (!pushRes.ok) {
      setActionLoading(null);
      flash(pushRes.error || "Push failed", "err");
      onRefresh();
      return;
    }

    const prTitle = extra?.prTitle || `Prototype: ${branch.slug}`;
    const prRes = await apiCreatePR(branch.name, prTitle);
    setActionLoading(null);

    if (prRes.ok && prRes.data) {
      flash(
        prRes.data.stubbed
          ? `PR stubbed: ${prRes.data.url}`
          : `PR created: ${prRes.data.url}`,
        prRes.data.stubbed ? "err" : "ok"
      );
    } else {
      flash(
        "Pushed but PR creation failed: " + (prRes.ok ? "" : prRes.error),
        "err"
      );
    }
    onRefresh();
  }

  function handleExecute(
    stage: PipelineStage,
    extra?: Record<string, string>
  ) {
    if (stage === "push-for-review") {
      handlePushAndPR(stage, extra);
    } else {
      handleCommit(stage, extra);
    }
  }

  const stageIndex = branch.completedStages.length;
  const totalStages = stageOrder.length;
  const progress = Math.min(stageIndex / totalStages, 1);
  const pipelineComplete = branch.nextStage === null;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-800">
        <div
          className={`h-full transition-all duration-500 ${pipelineComplete
            ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
            : "bg-gradient-to-r from-indigo-500 to-emerald-500"
            }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex items-start justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-100">
              {branch.slug}
            </h3>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium border bg-violet-500/20 text-violet-400 border-violet-500/30">
              REV+FWD
            </span>
            {pipelineComplete && (
              <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2 py-0.5 text-[10px] font-medium">
                COMPLETE
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {branch.name}
            <span className="ml-2 text-zinc-600">{branch.modulePath}</span>
          </p>
        </div>
        <div className="text-xs text-zinc-500 shrink-0">
          {stageIndex}/{totalStages} stages
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
            Progress
          </span>
        </div>
        <StageProgress
          completedStages={branch.completedStages}
          nextStage={branch.nextStage}
          stageOrder={stageOrder}
        />
      </div>

      <div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium block mb-2">
          Commits
        </span>
        <CommitTimeline commits={branch.commits} />
      </div>

      {branch.nextStage && (
        <div className="border-t border-zinc-800 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              Next Step
            </span>
            <span className="text-[10px] text-zinc-400 bg-zinc-800 rounded px-1.5 py-0.5">
              {STAGE_DESCRIPTIONS[branch.nextStage]}
            </span>
          </div>
          <NextStepPanel
            branch={branch}
            nextStage={branch.nextStage}
            loading={actionLoading === "commit"}
            onExecute={handleExecute}
            onFlash={flash}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {toast && (
        <div
          className={`absolute bottom-3 left-3 right-3 rounded px-3 py-2 text-xs font-medium transition-all ${toast.type === "ok"
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue panel
// ---------------------------------------------------------------------------

function QueuePanel({ jobs }: { jobs: QueueJob[] }) {
  if (jobs.length === 0) return null;

  const statusColors: Record<string, string> = {
    pending: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    running: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    complete: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    failed: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="text-sm font-medium text-zinc-200 mb-3">
        Mock Worker Queue
      </h3>
      <div className="space-y-2">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-xs text-zinc-300 font-mono truncate">
                {job.branch}
              </p>
              <p className="text-[10px] text-zinc-500">
                {job.id.slice(0, 8)} &middot; {formatDate(job.submittedAt)}
              </p>
            </div>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${statusColors[job.status] || ""}`}
            >
              {job.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zone 1: Import & Transform
// ---------------------------------------------------------------------------

const STORAGE_KEY = "react-grab-recent-items";

function ImportTransformZone({
  onBranchesCreated,
}: {
  onBranchesCreated: () => void;
}) {
  const [entries, setEntries] = useState<ManifestEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setError(
          "No annotations found in sessionStorage. Use react-grab to comment on components first."
        );
        return;
      }

      const items: OverlayItem[] = JSON.parse(raw);
      const commentItems = items.filter(
        (i: OverlayItem) => i.isComment && i.commentText
      );

      if (commentItems.length === 0) {
        setError(
          "No comment annotations found. Use react-grab to add comments to components."
        );
        return;
      }

      setImporting(true);
      setError(null);
      const res = await apiImportOverlay(commentItems);

      if (res.ok && res.data) {
        setEntries(res.data);
        setShowImport(false);
      } else {
        setError(!res.ok ? res.error : "Import failed");
      }
    } catch {
      setError("Failed to parse overlay items from sessionStorage");
    } finally {
      setImporting(false);
    }
  }

  async function handleSave() {
    const enabled = entries.filter((e) => e.enabled);
    if (enabled.length === 0) {
      setError("No entries enabled");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await apiSaveManifest(entries);
      if (res.ok) {
        setEntries([]);
        setShowImport(true);
        onBranchesCreated();
      } else {
        setError(!res.ok ? res.error : "Save failed");
      }
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateEntry(index: number, patch: Partial<ManifestEntry>) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e))
    );
  }

  const enabledCount = entries.filter((e) => e.enabled).length;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">
            Import & Transform
          </h3>
        </div>
        {!showImport && entries.length > 0 && (
          <button
            onClick={() => {
              setShowImport(true);
              setEntries([]);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            New Import
          </button>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200 text-xs ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {showImport && entries.length === 0 && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {importing ? "Importing..." : "Import from Overlay"}
        </button>
      )}

      {entries.length > 0 && (
        <>
          <div className="space-y-3">
            {entries.map((entry, i) => (
              <div
                key={entry.id}
                className={`rounded-lg border p-4 space-y-3 transition-opacity ${entry.enabled
                  ? "border-zinc-700 bg-zinc-800/50"
                  : "border-zinc-800/50 bg-zinc-800/20 opacity-50"
                  }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/30">
                      {entry.componentName}
                    </span>
                    {entry.componentPath ? (
                      <span className="text-[10px] text-zinc-500 font-mono truncate">
                        {entry.componentPath}
                        {entry.lineNumber ? `:${entry.lineNumber}` : ""}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400/80 italic">
                        unresolvable
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      updateEntry(i, { enabled: !entry.enabled })
                    }
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${entry.enabled
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : "bg-zinc-800 text-zinc-500 border-zinc-700"
                      }`}
                  >
                    {entry.enabled ? "ON" : "OFF"}
                  </button>
                </div>

                {!entry.componentPath && (
                  <div className="space-y-1">
                    <label className="block text-[10px] text-zinc-500">
                      File Path (manual entry)
                    </label>
                    <input
                      type="text"
                      value={entry.componentPath}
                      onChange={(e) =>
                        updateEntry(i, { componentPath: e.target.value })
                      }
                      placeholder="src/components/MyComponent.tsx"
                      className="w-full rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="block text-[10px] text-zinc-500">
                    Context
                  </label>
                  <textarea
                    value={entry.context}
                    onChange={(e) =>
                      updateEntry(i, { context: e.target.value })
                    }
                    rows={2}
                    className="w-full rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 resize-y"
                    placeholder="Describe what to extract and why..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-zinc-500 shrink-0">
                    Slug:
                  </label>
                  <input
                    type="text"
                    value={entry.slug}
                    onChange={(e) =>
                      updateEntry(i, { slug: e.target.value })
                    }
                    className="flex-1 rounded border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-zinc-600 font-mono">
                    &rarr; prototype/{entry.slug}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500">
              {enabledCount}/{entries.length} components selected &rarr;{" "}
              {enabledCount} branch{enabledCount !== 1 ? "es" : ""} will be
              created
            </p>
            <button
              onClick={handleSave}
              disabled={saving || enabledCount === 0}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {saving
                ? "Creating..."
                : `Save & Create ${enabledCount} Branch${enabledCount !== 1 ? "es" : ""}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PipelineDashboardPage() {
  const [branches, setBranches] = useState<PrototypeBranch[]>([]);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [branchRes, queueRes] = await Promise.all([
      fetchBranches(),
      fetchQueue(),
    ]);
    if (branchRes.ok && branchRes.data) {
      setBranches(branchRes.data);
      setError(null);
    } else {
      setError(!branchRes.ok ? branchRes.error : "Failed to fetch branches");
    }
    if (queueRes.ok && queueRes.data) {
      setJobs(queueRes.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <a
                href="/modules/final"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                &larr; Back to Final
              </a>
              <h1 className="text-2xl font-bold tracking-tight mt-1">
                Demo Stuffz
              </h1>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-auto max-w-5xl px-6 pt-4">
          <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200 text-xs ml-4"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
        <ImportTransformZone onBranchesCreated={refresh} />

        {loading && branches.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block h-6 w-6 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-zinc-500">Loading branches...</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-800 rounded-lg">
            <div className="text-4xl mb-3 opacity-30">&#9733;</div>
            <h2 className="text-lg font-medium text-zinc-300">
              No extraction branches yet
            </h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              Import overlay annotations above, edit contexts and slugs, then
              click &ldquo;Save &amp; Create Branches&rdquo; to start the
              extraction pipeline.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {branches.map((b) => (
              <BranchCard key={b.name} branch={b} onRefresh={refresh} />
            ))}
          </div>
        )}

        <QueuePanel jobs={jobs} />
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-10">
        <details className="group">
          <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Pipeline stages reference (REV+FWD &mdash; 6 stages)
          </summary>
          <div className="mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {getStageOrderForMode("reverse-and-forwards").map(
                (stage, i) => (
                  <div
                    key={stage}
                    className="rounded border border-zinc-800 bg-zinc-900/50 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-zinc-500">
                        {i + 1}.
                      </span>
                      <span className="text-xs font-medium text-zinc-300">
                        {STAGE_LABELS[stage]}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      {STAGE_DESCRIPTIONS[stage]}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

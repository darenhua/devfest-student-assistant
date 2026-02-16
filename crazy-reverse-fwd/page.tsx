"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ApiResponse,
  ModuleInfo,
  PipelineMode,
  PipelineStage,
  PrototypeBranch,
  PrototypeCommit,
  QueueJob,
} from "./types";
import {
  STAGE_DESCRIPTIONS,
  STAGE_LABELS,
  getStageOrderForMode,
} from "./types";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

const API_BASE = "/modules/crazy-reverse-fwd/api";

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

async function apiCreateBranch(
  name: string,
  sourceModulePath: string,
  mode: PipelineMode
) {
  return apiFetch<PrototypeBranch>("/create-branch", {
    method: "POST",
    body: JSON.stringify({ name, sourceModulePath, mode }),
  });
}

async function apiCommit(
  branch: string,
  stage: PipelineStage,
  extra?: {
    conversationDir?: string;
    guideHint?: string;
    prTitle?: string;
  }
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

async function fetchModules() {
  return apiFetch<ModuleInfo[]>("/modules?root=src/app/modules");
}

async function fetchQueue() {
  return apiFetch<QueueJob[]>("/queue");
}

async function apiStartSpecGen(
  branch: string,
  extra?: { conversationDir?: string; guideHint?: string }
) {
  return apiFetch<{ status: string }>("/generate-spec/start", {
    method: "POST",
    body: JSON.stringify({ branch, ...extra }),
  });
}

interface SpecTaskInfo {
  branch: string;
  modulePath: string;
  status: "running" | "complete" | "failed";
  startedAt: string;
  error?: string;
}

async function apiSpecGenStatus(branch: string) {
  return apiFetch<SpecTaskInfo | null>(
    `/generate-spec/status?branch=${encodeURIComponent(branch)}`
  );
}

// ---------------------------------------------------------------------------
// Stage progress component
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
                className={`h-0.5 w-3 sm:w-5 ${
                  done ? "bg-emerald-500" : "bg-zinc-700"
                }`}
              />
            )}
            <div className="group relative">
              <div
                className={`h-3 w-3 rounded-full border-2 transition-all ${
                  done
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
              className={`h-2 w-2 rounded-full ${
                c.stage ? "bg-emerald-500" : "bg-zinc-500"
              }`}
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
// Module Picker
// ---------------------------------------------------------------------------

function ModulePicker({
  modules,
  value,
  onChange,
  loading,
  label,
}: {
  modules: ModuleInfo[];
  value: string;
  onChange: (v: string) => void;
  loading: boolean;
  label?: string;
}) {
  if (loading) {
    return (
      <div className="text-xs text-zinc-500 py-2">Loading modules...</div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-xs text-zinc-400">
        {label || "Source Module"}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
      >
        <option value="">Select a module...</option>
        {modules.map((m) => (
          <option key={m.name} value={m.path}>
            {m.name} {m.hasSpec ? "(has SPEC)" : ""}
          </option>
        ))}
      </select>
      {value && (
        <p className="text-[10px] text-zinc-500 font-mono">{value}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Next-step action panel (stage-specific forms)
// ---------------------------------------------------------------------------

function NextStepPanel({
  branch,
  nextStage,
  loading,
  elapsedSeconds,
  onExecute,
  onFlash,
  onRefresh,
}: {
  branch: PrototypeBranch;
  nextStage: PipelineStage;
  loading: boolean;
  elapsedSeconds: number;
  onExecute: (
    stage: PipelineStage,
    extra?: Record<string, string>
  ) => void;
  onFlash: (msg: string, type: "ok" | "err") => void;
  onRefresh: () => void;
}) {
  const [convoDir, setConvoDir] = useState("");
  const [guideHint, setGuideHint] = useState("");
  const [prTitle, setPrTitle] = useState(`Prototype: ${branch.slug}`);

  // Async generate-spec state
  const [specGenRunning, setSpecGenRunning] = useState(false);
  const [specGenElapsed, setSpecGenElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
    setSpecGenElapsed(0);
  }

  async function handleStartSpecGen() {
    setSpecGenRunning(true);
    setSpecGenElapsed(0);

    const res = await apiStartSpecGen(branch.name, {
      ...(convoDir.trim() ? { conversationDir: convoDir.trim() } : {}),
      ...(guideHint.trim() ? { guideHint: guideHint.trim() } : {}),
    });

    if (!res.ok) {
      onFlash(res.error || "Failed to start spec generation", "err");
      stopPolling();
      return;
    }

    // Start elapsed timer
    timerRef.current = setInterval(() => {
      setSpecGenElapsed((s) => s + 1);
    }, 1000);

    // Poll every 5s
    pollRef.current = setInterval(async () => {
      const statusRes = await apiSpecGenStatus(branch.name);
      if (!statusRes.ok || !statusRes.data) return;

      const task = statusRes.data;
      if (task.status === "complete") {
        stopPolling();
        // Auto-commit the generate-spec stage now that SPEC.md is written
        const commitRes = await apiCommit(branch.name, "generate-spec");
        if (commitRes.ok) {
          onFlash("Spec generated and committed", "ok");
        } else {
          onFlash(
            commitRes.error || "Spec generated but commit failed",
            "err"
          );
        }
        onRefresh();
      } else if (task.status === "failed") {
        stopPolling();
        onFlash(task.error || "Spec generation failed", "err");
      }
    }, 5000);
  }

  // Stage: generate-spec (async: start → poll → auto-commit)
  if (nextStage === "generate-spec") {
    return (
      <div className="space-y-3">
        {!specGenRunning && (
          <>
            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-400">
                Conversation Directory{" "}
                <span className="text-zinc-600">(optional)</span>
              </label>
              <input
                type="text"
                value={convoDir}
                onChange={(e) => setConvoDir(e.target.value)}
                placeholder="Path to folder with HTML transcript files..."
                className="w-full rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs text-zinc-400">
                Guide Hint <span className="text-zinc-600">(optional)</span>
              </label>
              <textarea
                value={guideHint}
                onChange={(e) => setGuideHint(e.target.value)}
                rows={2}
                placeholder="The essence of this prototype in your words..."
                className="w-full rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
              />
              <p className="text-[10px] text-zinc-500">
                Brief hint about what matters most in this prototype
              </p>
            </div>
            <button
              onClick={handleStartSpecGen}
              className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 transition-colors"
            >
              Generate Spec
            </button>
          </>
        )}
        {specGenRunning && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-purple-400">
              <div className="h-3 w-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              <span>
                Claude is writing SPEC.md... ({specGenElapsed}s elapsed)
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">
              Polling every 5s. Will auto-commit when done.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Stage: implementation-started
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

  // Stage: implementation-complete
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

  // Stage: push-for-review
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mode = branch.mode || "reverse-and-forwards";
  const stageOrder = getStageOrderForMode(mode);

  function flash(msg: string, type: "ok" | "err") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Elapsed timer for long-running operations
  useEffect(() => {
    if (!actionLoading) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [actionLoading]);

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
  const modeBadge =
    mode === "forwards-only" ? "FWD" : "REV+FWD";
  const modeBadgeColor =
    mode === "forwards-only"
      ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
      : "bg-violet-500/20 text-violet-400 border-violet-500/30";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 space-y-4 relative overflow-hidden">
      {/* Progress bar at top of card */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-800">
        <div
          className={`h-full transition-all duration-500 ${
            pipelineComplete
              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
              : "bg-gradient-to-r from-indigo-500 to-emerald-500"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-zinc-100">
              {branch.slug}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${modeBadgeColor}`}
            >
              {modeBadge}
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

      {/* Stage progress */}
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

      {/* Commits */}
      <div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium block mb-2">
          Commits
        </span>
        <CommitTimeline commits={branch.commits} />
      </div>

      {/* Next step */}
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
            elapsedSeconds={elapsedSeconds}
            onExecute={handleExecute}
            onFlash={flash}
            onRefresh={onRefresh}
          />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`absolute bottom-3 left-3 right-3 rounded px-3 py-2 text-xs font-medium transition-all ${
            toast.type === "ok"
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
// Main page
// ---------------------------------------------------------------------------

export default function CrazyReverseFwdPage() {
  const [branches, setBranches] = useState<PrototypeBranch[]>([]);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [sourceModule, setSourceModule] = useState("");
  const [createMode, setCreateMode] = useState<PipelineMode>("reverse-and-forwards");
  const [creating, setCreating] = useState(false);

  // Determine if selected source module has a spec
  const selectedModuleInfo = modules.find((m) => m.path === sourceModule);
  const selectedHasSpec = selectedModuleInfo?.hasSpec ?? false;

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

  const loadModules = useCallback(async () => {
    setModulesLoading(true);
    const res = await fetchModules();
    if (res.ok && res.data) {
      setModules(res.data);
    }
    setModulesLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    loadModules();
  }, [refresh, loadModules]);

  async function handleCreate() {
    if (!newName.trim() || !sourceModule) return;
    setCreating(true);
    const res = await apiCreateBranch(newName.trim(), sourceModule, createMode);
    setCreating(false);
    if (res.ok) {
      setNewName("");
      setSourceModule("");
      setCreateMode("reverse-and-forwards");
      setShowCreate(false);
      refresh();
    } else {
      setError(!res.ok ? res.error : "Failed to create branch");
    }
  }

  const slugPreview = newName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <a
                href="/modules"
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                &larr; All Modules
              </a>
              <h1 className="text-2xl font-bold tracking-tight mt-1">
                Automated Prototype Pipeline
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Git + Prompt Generation + Claude SDK — end-to-end prototype
                automation
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={refresh}
                disabled={loading}
                className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
              >
                + New Prototype
              </button>
            </div>
          </div>

          {/* Create form */}
          {showCreate && (
            <div className="mt-4 border-t border-zinc-800 pt-4 space-y-3">
              {/* Branch name input */}
              <div className="flex items-center gap-0 rounded border border-zinc-700 bg-zinc-900 overflow-hidden">
                <span className="px-2.5 py-2 text-xs font-mono text-zinc-500 bg-zinc-800 border-r border-zinc-700 select-none">
                  prototype/
                </span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="auth-flow"
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                  autoFocus
                />
              </div>

              {/* Source module picker */}
              <ModulePicker
                modules={modules}
                value={sourceModule}
                onChange={(v) => {
                  setSourceModule(v);
                  // Reset mode when source changes
                  const mod = modules.find((m) => m.path === v);
                  if (!mod?.hasSpec) {
                    setCreateMode("reverse-and-forwards");
                  }
                }}
                loading={modulesLoading}
                label="Source of Truth Module"
              />

              {/* Mode selector — only show when source has a spec */}
              {sourceModule && selectedHasSpec && (
                <div className="space-y-1.5">
                  <label className="block text-xs text-zinc-400">
                    Pipeline Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateMode("forwards-only")}
                      className={`flex-1 rounded border px-3 py-2 text-xs font-medium transition-colors ${
                        createMode === "forwards-only"
                          ? "border-sky-500 bg-sky-500/10 text-sky-300"
                          : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <div className="font-semibold">Forwards Only</div>
                      <div className="text-[10px] mt-0.5 opacity-70">
                        Copy spec, skip generate, go to implementation
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateMode("reverse-and-forwards")}
                      className={`flex-1 rounded border px-3 py-2 text-xs font-medium transition-colors ${
                        createMode === "reverse-and-forwards"
                          ? "border-violet-500 bg-violet-500/10 text-violet-300"
                          : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <div className="font-semibold">Reverse + Forwards</div>
                      <div className="text-[10px] mt-0.5 opacity-70">
                        Copy as parent spec, then generate new spec
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {slugPreview && (
                <p className="text-xs text-zinc-500 font-mono">
                  Branch: prototype/{slugPreview} &rarr; Module:
                  src/app/modules/{slugPreview}/
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 items-center">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim() || !sourceModule}
                  className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating..." : "Create Branch"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-sm text-zinc-500 hover:text-zinc-300 px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error banner */}
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

      {/* Content */}
      <div className="mx-auto max-w-5xl px-6 py-6 space-y-4">
        {loading && branches.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-block h-6 w-6 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin" />
            <p className="mt-3 text-sm text-zinc-500">Loading branches...</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-zinc-800 rounded-lg">
            <div className="text-4xl mb-3 opacity-30">&#9733;</div>
            <h2 className="text-lg font-medium text-zinc-300">
              No prototypes yet
            </h2>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              Create a new prototype to start the pipeline. Choose
              &ldquo;Forwards Only&rdquo; to reuse a spec directly, or
              &ldquo;Reverse + Forwards&rdquo; to generate a new spec from a
              parent.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
            >
              + Create Your First Prototype
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {branches.map((b) => (
              <BranchCard
                key={b.name}
                branch={b}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}

        {/* Queue panel */}
        <QueuePanel jobs={jobs} />
      </div>

      {/* Legend / help */}
      <div className="mx-auto max-w-5xl px-6 pb-10">
        <details className="group">
          <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            Pipeline stages reference
          </summary>
          <div className="mt-3 space-y-4">
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-2">
                Forwards Only (FWD) — 4 stages
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {getStageOrderForMode("forwards-only").map((stage, i) => (
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
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-2">
                Reverse + Forwards (REV+FWD) — 5 stages
              </h4>
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
          </div>
        </details>
      </div>
    </div>
  );
}

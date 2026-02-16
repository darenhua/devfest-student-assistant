// Types for the crazy-reverse-fwd module
// Automated Prototype Pipeline — Git + Prompt Generation + Claude SDK

// --- Pipeline modes ---

export type PipelineMode = 'forwards-only' | 'reverse-and-forwards';

// --- Pipeline stages ---

export type PipelineStage =
  | 'init'
  | 'prompt-ready'
  | 'generate-spec'
  | 'make-implement'
  | 'implementation-started'
  | 'implementation-complete'
  | 'push-for-review';

export const STAGE_ORDER_FORWARDS: PipelineStage[] = [
  'init',
  'make-implement',
  'implementation-started',
  'implementation-complete',
  'push-for-review',
];

export const STAGE_ORDER_REVERSE: PipelineStage[] = [
  'init',
  'prompt-ready',
  'generate-spec',
  'make-implement',
  'implementation-started',
  'implementation-complete',
  'push-for-review',
];

export function getStageOrderForMode(mode: PipelineMode): PipelineStage[] {
  return mode === 'forwards-only' ? STAGE_ORDER_FORWARDS : STAGE_ORDER_REVERSE;
}

export const STAGE_LABELS: Record<PipelineStage, string> = {
  'init': 'Init',
  'prompt-ready': 'Prompt Ready',
  'generate-spec': 'Generate Spec',
  'make-implement': 'Make Implement',
  'implementation-started': 'Submit Job',
  'implementation-complete': 'Impl Complete',
  'push-for-review': 'Push & PR',
};

export const STAGE_DESCRIPTIONS: Record<PipelineStage, string> = {
  'init': 'Create module folder, set source of truth, write pipeline.json',
  'prompt-ready': 'Generate extraction prompt and commit to branch',
  'generate-spec': 'Invoke Claude SDK to write SPEC.md and commit result',
  'make-implement': 'Generate implement.md prompt file and commit to branch',
  'implementation-started': 'Generate implementation prompt and submit to queue',
  'implementation-complete': 'Mark implementation as complete',
  'push-for-review': 'Push branch to origin and create PR',
};

// --- Pipeline metadata (stored as pipeline.json in module dir) ---

export interface PipelineMeta {
  mode: PipelineMode;
  sourceModule: {
    name: string;
    path: string;
    hasSpec: boolean;
  };
  createdAt: string;
}

export interface LineageInfo {
  parentSpec: string;
  parentModule: string;
  childSpec: string;
  createdAt: string;
}

// --- Commit ---

export interface PrototypeCommit {
  hash: string;
  message: string;
  stage: PipelineStage | null;
  date: string;
  author: string;
}

// --- Branch ---

export interface PrototypeBranch {
  name: string;
  slug: string;
  modulePath: string;
  commits: PrototypeCommit[];
  completedStages: PipelineStage[];
  nextStage: PipelineStage | null;
  stageCount: number;
  mode?: PipelineMode;
  pipelineMeta?: PipelineMeta;
}

// --- API request types ---

export interface CommitRequest {
  branch: string;
  stage: PipelineStage;
  conversationDir?: string;
  guideHint?: string;
  prTitle?: string;
}

export interface CreateBranchRequest {
  name: string;
  sourceModulePath: string;
  mode: PipelineMode;
}

export interface PushRequest {
  branch: string;
}

export interface CreatePRRequest {
  branch: string;
  title: string;
  body?: string;
}

// --- Queue ---

export interface QueueJob {
  id: string;
  branch: string;
  modulePath: string;
  prompt: string;
  status: 'pending' | 'running' | 'complete' | 'failed';
  submittedAt: string;
  completedAt?: string;
}

// --- Module listing ---

export interface ModuleInfo {
  name: string;
  path: string;
  hasSpec: boolean;
}

// --- API Response ---

export type ApiResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

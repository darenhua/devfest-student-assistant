// Types for the final module's extraction pipeline
// Re-exports base types from crazy-reverse-fwd + adds overlay/manifest types

export type {
  PipelineMode,
  PipelineStage,
  PipelineMeta,
  LineageInfo,
  PrototypeCommit,
  PrototypeBranch,
  CommitRequest,
  CreateBranchRequest,
  PushRequest,
  CreatePRRequest,
  QueueJob,
  ModuleInfo,
  ApiResponse,
} from '../../../../crazy-reverse-fwd/types';

export {
  STAGE_ORDER_FORWARDS,
  STAGE_ORDER_REVERSE,
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
  getStageOrderForMode,
} from '../../../../crazy-reverse-fwd/types';

// --- Overlay item (read from sessionStorage) ---

export interface OverlayItem {
  id: string;
  content: string;
  elementName: string;
  tagName: string;
  componentName?: string;
  isComment: boolean;
  commentText?: string;
  timestamp: number;
}

// --- Manifest entry (cleaned-up, pipeline-ready) ---

export interface ManifestEntry {
  id: string;
  componentPath: string;
  lineNumber: number | null;
  componentName: string;
  context: string;
  slug: string;
  enabled: boolean;
}

export interface Manifest {
  createdAt: string;
  entries: ManifestEntry[];
}

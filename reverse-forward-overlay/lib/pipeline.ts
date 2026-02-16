// Re-export all pipeline functions from crazy-reverse-fwd.
// The LEVEL-2 module reuses the same pipeline infrastructure.
// The only difference is in generate-spec/start route (uses extract-component-spec.md template
// and reads manifest.json) — that logic lives in the API route, not here.

export {
  parseBranch,
  readPipelineMetaFromBranch,
  getCurrentBranch,
  getCommitsForBranch,
  getCompletedStages,
  getNextStage,
  listPrototypeBranches,
  createBranch,
  addCommit,
  pushBranch,
  createPullRequest,
} from '../../crazy-reverse-fwd/lib/pipeline';

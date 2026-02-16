// Re-export spec task tracker from crazy-reverse-fwd
// Shares the same in-memory task map (singleton module)
export {
  getSpecTask,
  startSpecTask,
  completeSpecTask,
  failSpecTask,
  clearSpecTask,
  type SpecTask,
  type SpecTaskStatus,
} from '../../crazy-reverse-fwd/lib/spec-task';

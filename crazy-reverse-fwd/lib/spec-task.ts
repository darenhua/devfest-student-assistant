import type { ClaudeSDKResult } from './claude-sdk';

export type SpecTaskStatus = 'running' | 'complete' | 'failed';

export interface SpecTask {
  branch: string;
  modulePath: string;
  status: SpecTaskStatus;
  startedAt: string;
  result?: ClaudeSDKResult;
  error?: string;
}

// In-memory task tracker — one active task per branch
const tasks = new Map<string, SpecTask>();

export function getSpecTask(branch: string): SpecTask | null {
  return tasks.get(branch) ?? null;
}

export function startSpecTask(branch: string, modulePath: string): SpecTask {
  const task: SpecTask = {
    branch,
    modulePath,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  tasks.set(branch, task);
  return task;
}

export function completeSpecTask(branch: string, result: ClaudeSDKResult): void {
  const task = tasks.get(branch);
  if (!task) return;
  task.status = 'complete';
  task.result = result;
}

export function failSpecTask(branch: string, error: string): void {
  const task = tasks.get(branch);
  if (!task) return;
  task.status = 'failed';
  task.error = error;
}

export function clearSpecTask(branch: string): void {
  tasks.delete(branch);
}

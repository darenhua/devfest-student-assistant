import fs from 'fs';
import path from 'path';
import type { QueueJob } from '../types';

const QUEUE_PATH = path.join(process.cwd(), 'script', 'spec-gen-kit', 'output', 'queue.json');

function readQueue(): QueueJob[] {
  try {
    if (!fs.existsSync(QUEUE_PATH)) return [];
    const raw = fs.readFileSync(QUEUE_PATH, 'utf-8');
    return JSON.parse(raw) as QueueJob[];
  } catch {
    return [];
  }
}

function writeQueue(jobs: QueueJob[]): void {
  const dir = path.dirname(QUEUE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(jobs, null, 2) + '\n', 'utf-8');
}

export function appendToQueue(job: QueueJob): void {
  const jobs = readQueue();
  jobs.push(job);
  writeQueue(jobs);
}

export function updateJobStatus(
  jobId: string,
  status: QueueJob['status'],
): void {
  const jobs = readQueue();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Queue job not found: ${jobId}`);
  job.status = status;
  if (status === 'complete') {
    job.completedAt = new Date().toISOString();
  }
  writeQueue(jobs);
}

export function getJob(jobId: string): QueueJob | undefined {
  return readQueue().find((j) => j.id === jobId);
}

export function listJobs(): QueueJob[] {
  return readQueue();
}

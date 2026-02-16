import { NextRequest, NextResponse } from 'next/server';
import { addCommit, parseBranch } from '../../lib/pipeline';
import type { ApiResponse, CommitRequest, PrototypeCommit } from '../../pipeline-types';

const REPO_ROOT = process.cwd();
const MODULES_DIR = 'src/app/modules';
const WORKER_API = 'http://localhost:3002/api/jobs';

// Guard against double-polling for the same branch
const pollingBranches = new Set<string>();

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<PrototypeCommit>>> {
  try {
    const body: CommitRequest = await req.json();

    if (!body.branch || typeof body.branch !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: branch' },
        { status: 400 },
      );
    }

    if (!body.stage || typeof body.stage !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: stage' },
        { status: 400 },
      );
    }

    const commit = await addCommit(body.branch, body.stage, body);

    // After implementation-started commits, start polling the worker queue
    if (body.stage === 'implementation-started' && !pollingBranches.has(body.branch)) {
      const slug = parseBranch(body.branch);
      if (slug) {
        const modulePath = `${MODULES_DIR}/${slug}`;

        // Read job ID from the marker committed to the branch
        let jobId: string | null = null;
        try {
          const { execSync } = await import('child_process');
          const markerContent = execSync(
            `git show ${body.branch}:${modulePath}/.implementation-started`,
            { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 10_000 },
          ).trim();
          const marker = JSON.parse(markerContent);
          jobId = marker.jobId;
        } catch {
          console.error(`[poll][${body.branch}] Could not read .implementation-started marker from branch`);
        }

        if (jobId) {
          pollingBranches.add(body.branch);
          pollWorkerQueue(body.branch, jobId)
            .finally(() => pollingBranches.delete(body.branch));
        }
      }
    }

    return NextResponse.json({ ok: true, data: commit });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('out of order') || message.includes('not the next') ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

async function pollWorkerQueue(branch: string, jobId: string): Promise<void> {
  const POLL_INTERVAL = 10_000; // 10 seconds
  const MAX_POLLS = 360;        // 1 hour max

  console.log(`[poll][${branch}] Starting to poll worker job ${jobId}`);

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

    try {
      const res = await fetch(`${WORKER_API}/${jobId}`);
      if (!res.ok) {
        console.error(`[poll][${branch}] Worker API returned ${res.status}`);
        continue;
      }

      const data = await res.json() as { job: { status: string } };
      const status = data.job?.status;

      if (status === 'completed') {
        console.log(`[poll][${branch}] Job ${jobId} completed! Auto-advancing to implementation-complete.`);
        try {
          await addCommit(branch, 'implementation-complete');
          console.log(`[poll][${branch}] implementation-complete committed`);
        } catch (err) {
          console.error(`[poll][${branch}] Failed to commit implementation-complete:`, err);
        }
        return;
      }

      if (status === 'failed') {
        console.error(`[poll][${branch}] Job ${jobId} failed. Stopping poll.`);
        return;
      }

      // Still pending or claimed — keep polling
      console.log(`[poll][${branch}] Job ${jobId} status: ${status} (poll ${i + 1}/${MAX_POLLS})`);
    } catch (err) {
      console.error(`[poll][${branch}] Poll error:`, err);
    }
  }

  console.error(`[poll][${branch}] Timed out after ${MAX_POLLS} polls`);
}

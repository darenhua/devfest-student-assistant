import { NextResponse } from 'next/server';
import { listJobs } from '../../lib/queue';
import type { ApiResponse, QueueJob } from '../../pipeline-types';

export async function GET(): Promise<NextResponse<ApiResponse<QueueJob[]>>> {
  try {
    const jobs = listJobs();
    return NextResponse.json({ ok: true, data: jobs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createPullRequest } from '../../lib/pipeline';
import type { ApiResponse, CreatePRRequest } from '../../types';

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<{ url: string; stubbed: boolean }>>> {
  try {
    const body: CreatePRRequest = await req.json();

    if (!body.branch || typeof body.branch !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: branch' },
        { status: 400 },
      );
    }

    if (!body.title || typeof body.title !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: title' },
        { status: 400 },
      );
    }

    const result = createPullRequest(body.branch, body.title, body.body);
    return NextResponse.json({ ok: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

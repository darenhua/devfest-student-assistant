import { NextRequest, NextResponse } from 'next/server';
import { createBranch } from '../../lib/pipeline';
import type { ApiResponse, CreateBranchRequest, PrototypeBranch } from '../../types';

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<PrototypeBranch>>> {
  try {
    const body: CreateBranchRequest = await req.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: name' },
        { status: 400 },
      );
    }

    if (!body.sourceModulePath || typeof body.sourceModulePath !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: sourceModulePath' },
        { status: 400 },
      );
    }

    if (body.mode !== 'forwards-only' && body.mode !== 'reverse-and-forwards') {
      return NextResponse.json(
        { ok: false, error: 'Invalid mode. Must be "forwards-only" or "reverse-and-forwards"' },
        { status: 400 },
      );
    }

    const branch = await createBranch(body.name, body.sourceModulePath, body.mode);
    return NextResponse.json({ ok: true, data: branch });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

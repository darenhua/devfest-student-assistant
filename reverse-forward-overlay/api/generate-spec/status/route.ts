import { NextRequest, NextResponse } from 'next/server';
import { getSpecTask } from '../../../lib/spec-task';
import type { ApiResponse } from '../../../types';
import type { SpecTask } from '../../../lib/spec-task';

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<SpecTask | null>>> {
  try {
    const branch = req.nextUrl.searchParams.get('branch');

    if (!branch) {
      return NextResponse.json(
        { ok: false, error: 'Missing query param: branch' },
        { status: 400 },
      );
    }

    const task = getSpecTask(branch);
    return NextResponse.json({ ok: true, data: task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

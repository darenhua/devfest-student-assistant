import { NextResponse } from 'next/server';
import { listPrototypeBranches } from '../../lib/pipeline';
import type { ApiResponse, PrototypeBranch } from '../../types';

export async function GET(): Promise<NextResponse<ApiResponse<PrototypeBranch[]>>> {
  try {
    const branches = listPrototypeBranches();
    return NextResponse.json({ ok: true, data: branches });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { addCommit } from '../../lib/pipeline';
import type {
  ApiResponse,
  CommitRequest,
  PrototypeCommit,
} from '../../types';
import { STAGE_ORDER_FORWARDS, STAGE_ORDER_REVERSE } from '../../types';

const ALL_VALID_STAGES = [...new Set([...STAGE_ORDER_FORWARDS, ...STAGE_ORDER_REVERSE])];

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

    if (!body.stage || !ALL_VALID_STAGES.includes(body.stage)) {
      return NextResponse.json(
        { ok: false, error: `Invalid stage. Must be one of: ${ALL_VALID_STAGES.join(', ')}` },
        { status: 400 },
      );
    }

    const commit = await addCommit(body.branch, body.stage, body);

    return NextResponse.json({ ok: true, data: commit });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('not allowed') ? 409 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

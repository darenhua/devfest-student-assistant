import { NextRequest, NextResponse } from 'next/server';
import { parseOverlayItems } from '../../lib/manifest';
import type { ApiResponse, ManifestEntry, OverlayItem } from '../../types';

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<ManifestEntry[]>>> {
  try {
    const body = await req.json();
    const { items } = body as { items: OverlayItem[] };

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: items (array)' },
        { status: 400 },
      );
    }

    const entries = parseOverlayItems(items);
    return NextResponse.json({ ok: true, data: entries });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

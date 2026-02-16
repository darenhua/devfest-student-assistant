import { NextRequest, NextResponse } from 'next/server';
import { listModules } from '../../lib/templates';
import type { ApiResponse, ModuleInfo } from '../../pipeline-types';

const DEFAULT_PROJECT_ROOT = 'src/app/modules';

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<ModuleInfo[]>>> {
  try {
    const projectRoot =
      req.nextUrl.searchParams.get('root') || DEFAULT_PROJECT_ROOT;

    const modules = listModules(projectRoot);
    return NextResponse.json({ ok: true, data: modules });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

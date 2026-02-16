import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseBranch,
  getCommitsForBranch,
  getCompletedStages,
  getNextStage,
  readPipelineMetaFromBranch,
} from '../../../lib/pipeline';
import type { PipelineStage } from '../../../pipeline-types';
import type { ApiResponse } from '../../../pipeline-types';

const REPO_ROOT = process.cwd();
const MODULES_DIR = 'src/app/modules';

export interface SpecGenStatus {
  completedStages: PipelineStage[];
  nextStage: PipelineStage | null;
  specFileExists: boolean;
}

export async function GET(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<SpecGenStatus>>> {
  try {
    const branch = req.nextUrl.searchParams.get('branch');

    if (!branch) {
      return NextResponse.json(
        { ok: false, error: 'Missing query param: branch' },
        { status: 400 },
      );
    }

    const slug = parseBranch(branch);
    if (!slug) {
      return NextResponse.json(
        { ok: false, error: 'Invalid branch name' },
        { status: 400 },
      );
    }

    const modulePath = `${MODULES_DIR}/${slug}`;
    const pipelineMeta = readPipelineMetaFromBranch(branch, modulePath);
    const mode = pipelineMeta?.mode;
    const commits = getCommitsForBranch(branch);
    const completedStages = getCompletedStages(commits);
    const nextStage = getNextStage(commits, mode);

    // Check if SPEC.md exists on disk (SDK may have written it but commit hasn't happened yet)
    const specFileExists = fs.existsSync(
      path.join(REPO_ROOT, modulePath, 'SPEC.md'),
    );

    return NextResponse.json({
      ok: true,
      data: { completedStages, nextStage, specFileExists },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

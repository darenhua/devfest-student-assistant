import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import {
  readPipelineMetaFromBranch,
  parseBranch,
  getCommitsForBranch,
  getNextStage,
} from '../../../lib/pipeline';
import { readTemplate, substituteTemplate, writeOutput } from '../../../lib/templates';
import { generateSpecWithClaude } from '../../../lib/claude-sdk';
import {
  startSpecTask,
  completeSpecTask,
  failSpecTask,
  getSpecTask,
} from '../../../lib/spec-task';
import type { ApiResponse } from '../../../types';

const REPO_ROOT = process.cwd();
const MODULES_DIR = 'src/app/modules';

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<{ status: string }>>> {
  try {
    const body = await req.json();
    const { branch, conversationDir, guideHint } = body as {
      branch: string;
      conversationDir?: string;
      guideHint?: string;
    };

    if (!branch || typeof branch !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: branch' },
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

    // Check if there's already a running task
    const existing = getSpecTask(branch);
    if (existing?.status === 'running') {
      return NextResponse.json({
        ok: true,
        data: { status: 'already-running' },
      });
    }

    // Validate stage order — generate-spec must be the next stage
    const modulePath = `${MODULES_DIR}/${slug}`;
    const pipelineMeta = readPipelineMetaFromBranch(branch, modulePath);
    const mode = pipelineMeta?.mode;
    const commits = getCommitsForBranch(branch);
    const nextStage = getNextStage(commits, mode);

    if (nextStage !== 'generate-spec') {
      return NextResponse.json(
        { ok: false, error: `generate-spec is not the next stage. Next: ${nextStage}` },
        { status: 409 },
      );
    }

    // Read pipeline.json for source module path (via git show, no checkout)
    if (!pipelineMeta) {
      return NextResponse.json(
        { ok: false, error: 'pipeline.json not found on branch' },
        { status: 500 },
      );
    }

    const sourceOfTruth = pipelineMeta.sourceModule.path;

    // Generate prompt from template
    const template = readTemplate('spec-gen-only.md');
    const prompt = substituteTemplate(template, {
      WORKING_DIR: sourceOfTruth,
      CONVERSATION_DIR: conversationDir || '',
      GUIDE_HINT: guideHint || '',
    });
    writeOutput('spec-gen-only-prompt.md', prompt);

    // Ensure the module directory exists on disk for Claude to write into.
    // It may not exist on the current branch (main) since it was created
    // on the prototype branch during init.
    const absModulePath = path.join(REPO_ROOT, modulePath);
    fs.mkdirSync(absModulePath, { recursive: true });

    // Start background task — fire and forget
    const task = startSpecTask(branch, modulePath);

    generateSpecWithClaude(prompt, modulePath)
      .then((result) => {
        if (result.success) {
          const specExists = fs.existsSync(path.join(absModulePath, 'SPEC.md'));
          if (specExists) {
            completeSpecTask(branch, result);
          } else {
            failSpecTask(branch, 'Claude SDK succeeded but SPEC.md was not written');
          }
        } else {
          failSpecTask(branch, result.error || 'Claude SDK failed');
        }
      })
      .catch((err) => {
        failSpecTask(branch, err instanceof Error ? err.message : String(err));
      });

    return NextResponse.json({
      ok: true,
      data: { status: 'started' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

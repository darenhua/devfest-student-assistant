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
import { getManifestEntryForSlug } from '../../../lib/manifest';
import type { ApiResponse } from '../../../types';

const REPO_ROOT = process.cwd();
const MODULES_DIR = 'src/app/modules';

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<{ status: string }>>> {
  try {
    const body = await req.json();
    const { branch } = body as { branch: string };

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

    if (!pipelineMeta) {
      return NextResponse.json(
        { ok: false, error: 'pipeline.json not found on branch' },
        { status: 500 },
      );
    }

    // Read manifest.json for component-specific info
    const manifestEntry = getManifestEntryForSlug(slug);

    // Determine which template to use based on whether we have manifest data
    let prompt: string;

    if (manifestEntry) {
      // LEVEL-2: Use extract-component-spec.md template with component-level placeholders
      const template = readTemplate('extract-component-spec.md');
      prompt = substituteTemplate(template, {
        COMPONENT_PATH: manifestEntry.componentPath,
        COMPONENT_NAME: manifestEntry.componentName,
        CONTEXT: manifestEntry.context,
        LINE_NUMBER: manifestEntry.lineNumber?.toString() || 'N/A',
      });
      writeOutput(`${slug}-extract-spec-prompt.md`, prompt);
    } else {
      // Fallback: Use spec-gen-only.md (original COMBINE-SPEC behavior)
      const sourceOfTruth = pipelineMeta.sourceModule.path;
      const template = readTemplate('spec-gen-only.md');
      prompt = substituteTemplate(template, {
        WORKING_DIR: sourceOfTruth,
        CONVERSATION_DIR: '',
        GUIDE_HINT: '',
      });
      writeOutput('spec-gen-only-prompt.md', prompt);
    }

    // Ensure the module directory exists on disk for Claude to write into
    const absModulePath = path.join(REPO_ROOT, modulePath);
    fs.mkdirSync(absModulePath, { recursive: true });

    // Start background task — fire and forget
    startSpecTask(branch, modulePath);

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

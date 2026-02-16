import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  readPipelineMetaFromBranch,
  parseBranch,
  getCommitsForBranch,
  getNextStage,
  addCommit,
} from '../../../lib/pipeline';
import { readTemplate, substituteTemplate } from '../../../lib/templates';
import { generateSpecWithClaude } from '../../../lib/claude-sdk';
import { getManifestEntryForSlug } from '../../../lib/manifest';
import type { ApiResponse } from '../../../pipeline-types';

const REPO_ROOT = process.cwd();
const MODULES_DIR = 'src/app/modules';

// Minimal process-level guard to prevent double SDK invocations
const runningBranches = new Set<string>();

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

    const modulePath = `${MODULES_DIR}/${slug}`;
    const pipelineMeta = readPipelineMetaFromBranch(branch, modulePath);
    const mode = pipelineMeta?.mode;
    const commits = getCommitsForBranch(branch);
    const nextStage = getNextStage(commits, mode);

    // --- Stage: prompt-ready ---
    if (nextStage === 'prompt-ready') {
      if (!pipelineMeta) {
        return NextResponse.json(
          { ok: false, error: 'pipeline.json not found on branch' },
          { status: 500 },
        );
      }

      // Generate the extraction prompt
      const manifestEntry = getManifestEntryForSlug(slug);
      let prompt: string;

      if (manifestEntry) {
        const template = readTemplate('extract-component-spec.md');
        prompt = substituteTemplate(template, {
          COMPONENT_PATH: manifestEntry.componentPath,
          COMPONENT_NAME: manifestEntry.componentName,
          CONTEXT: manifestEntry.context,
          LINE_NUMBER: manifestEntry.lineNumber?.toString() || 'N/A',
          MODULE_PATH: modulePath,
        });
      } else {
        const sourceOfTruth = pipelineMeta.sourceModule.path;
        const template = readTemplate('spec-gen-only.md');
        prompt = substituteTemplate(template, {
          WORKING_DIR: sourceOfTruth,
          CONVERSATION_DIR: '',
          GUIDE_HINT: '',
        });
      }

      // Commit the prompt to the branch as a durable artifact
      await addCommit(branch, 'prompt-ready', {
        _prompt: prompt,
      } as Record<string, unknown> as any);

      // After addCommit checks back to main, the module dir is gone.
      // Re-create it so the SDK can write SPEC.md there.
      const absModulePath = path.join(REPO_ROOT, modulePath);
      fs.mkdirSync(absModulePath, { recursive: true });

      // Now auto-continue: fire the SDK async
      if (runningBranches.has(branch)) {
        return NextResponse.json({
          ok: true,
          data: { status: 'prompt-committed' },
        });
      }

      runningBranches.add(branch);

      // Read prompt back from what we just generated (we still have it in memory)
      generateSpecWithClaude(prompt, modulePath, branch)
        .then(async (result) => {
          console.log(`[spec-gen][${branch}] SDK returned: success=${result.success}`);
          if (result.success) {
            const specPath = path.join(absModulePath, 'SPEC.md');
            if (fs.existsSync(specPath)) {
              // Read SPEC.md into memory before addCommit changes branches
              const specContent = fs.readFileSync(specPath, 'utf-8');
              try {
                await addCommit(branch, 'generate-spec', {
                  _specContent: specContent,
                } as any);
                console.log(`[spec-gen][${branch}] generate-spec committed`);
                // Auto-continue: make-implement is trivial, no SDK needed
                await addCommit(branch, 'make-implement');
                console.log(`[spec-gen][${branch}] make-implement committed`);
              } catch (err) {
                console.error(`[spec-gen][${branch}] Failed to commit generate-spec/make-implement:`, err);
              }
            } else {
              console.error(`[spec-gen][${branch}] SDK succeeded but SPEC.md not found at ${specPath}`);
            }
          } else {
            console.error(`[spec-gen][${branch}] SDK failed: ${result.error}`);
          }
        })
        .catch((err) => {
          console.error(`[spec-gen][${branch}] SDK threw:`, err);
        })
        .finally(() => {
          runningBranches.delete(branch);
        });

      return NextResponse.json({
        ok: true,
        data: { status: 'prompt-committed' },
      });
    }

    // --- Stage: generate-spec (retry case) ---
    if (nextStage === 'generate-spec') {
      if (runningBranches.has(branch)) {
        return NextResponse.json({
          ok: true,
          data: { status: 'already-running' },
        });
      }

      // Re-create module dir on disk
      const absModulePath = path.join(REPO_ROOT, modulePath);
      fs.mkdirSync(absModulePath, { recursive: true });

      // Read prompt from git (committed during prompt-ready)
      let prompt: string;
      try {
        prompt = execSync(
          `git show ${branch}:${modulePath}/extraction-prompt.md`,
          { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 10_000 },
        ).trim();
      } catch {
        return NextResponse.json(
          { ok: false, error: 'extraction-prompt.md not found on branch. prompt-ready stage may not have completed.' },
          { status: 500 },
        );
      }

      runningBranches.add(branch);

      generateSpecWithClaude(prompt, modulePath, branch)
        .then(async (result) => {
          console.log(`[spec-gen][${branch}] SDK returned: success=${result.success}`);
          if (result.success) {
            const specPath = path.join(absModulePath, 'SPEC.md');
            if (fs.existsSync(specPath)) {
              // Read SPEC.md into memory before addCommit changes branches
              const specContent = fs.readFileSync(specPath, 'utf-8');
              try {
                await addCommit(branch, 'generate-spec', {
                  _specContent: specContent,
                } as any);
                console.log(`[spec-gen][${branch}] generate-spec committed`);
                // Auto-continue: make-implement is trivial, no SDK needed
                await addCommit(branch, 'make-implement');
                console.log(`[spec-gen][${branch}] make-implement committed`);
              } catch (err) {
                console.error(`[spec-gen][${branch}] Failed to commit generate-spec/make-implement:`, err);
              }
            } else {
              console.error(`[spec-gen][${branch}] SDK succeeded but SPEC.md not found at ${specPath}`);
            }
          } else {
            console.error(`[spec-gen][${branch}] SDK failed: ${result.error}`);
          }
        })
        .catch((err) => {
          console.error(`[spec-gen][${branch}] SDK threw:`, err);
        })
        .finally(() => {
          runningBranches.delete(branch);
        });

      return NextResponse.json({
        ok: true,
        data: { status: 'started' },
      });
    }

    // --- Stage: make-implement (retry if auto-continue failed) ---
    if (nextStage === 'make-implement') {
      await addCommit(branch, 'make-implement');
      console.log(`[spec-gen][${branch}] make-implement committed`);
      return NextResponse.json({
        ok: true,
        data: { status: 'make-implement-committed' },
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unexpected next stage: ${nextStage}. Expected prompt-ready, generate-spec, or make-implement.` },
      { status: 409 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

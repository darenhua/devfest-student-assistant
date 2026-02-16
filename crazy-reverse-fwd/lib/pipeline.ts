import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  type CommitRequest,
  type LineageInfo,
  type PipelineMode,
  type PipelineMeta,
  type PipelineStage,
  type PrototypeBranch,
  type PrototypeCommit,
  getStageOrderForMode,
  STAGE_ORDER_REVERSE,
} from '../types';
import { writeOutput } from './templates';

// --- Configuration ---
const REPO_ROOT = process.cwd();
const MODULES_DIR = 'src/app/modules';
const BASE_BRANCH = 'main';
const BRANCH_PREFIX = 'prototype';

// All valid stages across both modes (for parsing commit messages)
const ALL_STAGES: PipelineStage[] = [
  'init',
  'prompt-ready',
  'generate-spec',
  'make-implement',
  'implementation-started',
  'implementation-complete',
  'push-for-review',
];

// --- Low-level helpers ---

function exec(command: string, opts?: { allowFailure?: boolean }): string {
  try {
    return execSync(command, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 30_000,
    }).trim();
  } catch (error: unknown) {
    if (opts?.allowFailure) return '';
    const msg =
      error instanceof Error
        ? (error as Error & { stderr?: string }).stderr || error.message
        : String(error);
    throw new Error(`Git command failed: ${command}\n${msg}`);
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// --- Branch name format: prototype/{slug} ---

export function parseBranch(branchName: string): string | null {
  if (!branchName.startsWith(`${BRANCH_PREFIX}/`)) return null;
  return branchName.slice(BRANCH_PREFIX.length + 1);
}

function modulePathFromSlug(slug: string): string {
  return `${MODULES_DIR}/${slug}`;
}

// --- Pipeline metadata ---

export function readPipelineMetaFromBranch(
  branchName: string,
  modulePath: string,
): PipelineMeta | null {
  const filePath = `${modulePath}/pipeline.json`;
  const content = exec(`git show ${branchName}:${filePath}`, {
    allowFailure: true,
  });
  if (!content) return null;
  try {
    return JSON.parse(content) as PipelineMeta;
  } catch {
    return null;
  }
}

// --- Stage state machine ---

function parseStageFromMessage(message: string): PipelineStage | null {
  const match = message.match(/^\[([^\]]+)\]/);
  if (!match) return null;
  const tag = match[1] as PipelineStage;
  return ALL_STAGES.includes(tag) ? tag : null;
}

function stash(): boolean {
  const result = exec('git stash push -m "crazy-reverse-fwd-auto-stash"', {
    allowFailure: true,
  });
  return !!result && !result.includes('No local changes');
}

function unstash(): void {
  exec('git stash pop', { allowFailure: true });
}

// --- Read-only queries ---

export function getCurrentBranch(): string {
  return exec('git rev-parse --abbrev-ref HEAD');
}

export function getCommitsForBranch(branchName: string): PrototypeCommit[] {
  const log = exec(
    `git log ${BASE_BRANCH}..${branchName} --format="%H|%s|%ai|%an" --reverse`,
    { allowFailure: true },
  );
  if (!log) return [];

  return log
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split('|');
      const hash = parts[0];
      const message = parts[1];
      const date = parts[2];
      const author = parts.slice(3).join('|');
      return {
        hash,
        message,
        stage: parseStageFromMessage(message),
        date,
        author,
      };
    });
}

export function getCompletedStages(
  commits: PrototypeCommit[],
): PipelineStage[] {
  return commits
    .map((c) => c.stage)
    .filter((s): s is PipelineStage => s !== null);
}

export function getNextStage(
  commits: PrototypeCommit[],
  mode?: PipelineMode,
): PipelineStage | null {
  const stageOrder = mode
    ? getStageOrderForMode(mode)
    : STAGE_ORDER_REVERSE; // default to longer pipeline
  const completed = getCompletedStages(commits);

  if (completed.length === 0) return 'init';

  const lastCompleted = completed[completed.length - 1];
  const lastIndex = stageOrder.indexOf(lastCompleted);

  if (lastCompleted === 'push-for-review') return null;
  if (lastIndex < 0 || lastIndex >= stageOrder.length - 1) return null;

  return stageOrder[lastIndex + 1];
}

export function listPrototypeBranches(): PrototypeBranch[] {
  const branchOutput = exec(
    `git branch --list "${BRANCH_PREFIX}/*" --format="%(refname:short)"`,
    { allowFailure: true },
  );
  if (!branchOutput) return [];

  const branches: PrototypeBranch[] = [];

  for (const line of branchOutput.split('\n')) {
    if (!line.trim()) continue;
    const name = line.trim();
    const slug = parseBranch(name);
    if (!slug) continue;

    const modulePath = modulePathFromSlug(slug);
    const pipelineMeta = readPipelineMetaFromBranch(name, modulePath);
    const mode = pipelineMeta?.mode;
    const stageOrder = mode
      ? getStageOrderForMode(mode)
      : STAGE_ORDER_REVERSE;

    const commits = getCommitsForBranch(name);
    const completedStages = getCompletedStages(commits);
    const nextStage = getNextStage(commits, mode);

    branches.push({
      name,
      slug,
      modulePath,
      commits,
      completedStages,
      nextStage,
      stageCount: stageOrder.length,
      mode,
      pipelineMeta: pipelineMeta ?? undefined,
    });
  }

  branches.sort((a, b) => a.slug.localeCompare(b.slug));
  return branches;
}

// --- Branch creation (now auto-runs init) ---

export async function createBranch(
  name: string,
  sourceModulePath: string,
  mode: PipelineMode,
): Promise<PrototypeBranch> {
  const slug = slugify(name);
  if (!slug) {
    throw new Error('Name must contain at least one alphanumeric character');
  }

  const branchName = `${BRANCH_PREFIX}/${slug}`;

  const existing = exec(`git branch --list "${branchName}"`, {
    allowFailure: true,
  });
  if (existing) {
    throw new Error(`Branch '${branchName}' already exists`);
  }

  // Validate source module path
  const absSourcePath = path.isAbsolute(sourceModulePath)
    ? sourceModulePath
    : path.join(REPO_ROOT, sourceModulePath);
  if (!fs.existsSync(absSourcePath) || !fs.statSync(absSourcePath).isDirectory()) {
    throw new Error(`Source module path does not exist or is not a directory: ${sourceModulePath}`);
  }

  // Determine source module info
  const sourceModuleName = path.basename(sourceModulePath);
  const sourceHasSpec = fs.existsSync(path.join(absSourcePath, 'SPEC.md'));

  // Create the branch
  exec(`git branch ${branchName} ${BASE_BRANCH}`);

  // Auto-run init commit
  const modulePath = modulePathFromSlug(slug);
  const initCommit = await addCommit(branchName, 'init', {
    _sourceModulePath: sourceModulePath,
    _mode: mode,
    _sourceModuleName: sourceModuleName,
    _sourceHasSpec: sourceHasSpec,
  } as Record<string, unknown> as Partial<CommitRequest>);

  const stageOrder = getStageOrderForMode(mode);

  return {
    name: branchName,
    slug,
    modulePath,
    commits: [initCommit],
    completedStages: ['init'],
    nextStage: getNextStage([initCommit], mode),
    stageCount: stageOrder.length,
    mode,
    pipelineMeta: {
      mode,
      sourceModule: {
        name: sourceModuleName,
        path: sourceModulePath,
        hasSpec: sourceHasSpec,
      },
      createdAt: new Date().toISOString(),
    },
  };
}

// --- Commit pipeline ---

export async function addCommit(
  branchName: string,
  stage: PipelineStage,
  options?: Partial<CommitRequest>,
): Promise<PrototypeCommit> {
  const slug = parseBranch(branchName);
  if (!slug) {
    throw new Error(`Branch '${branchName}' does not match prototype/{slug} naming convention`);
  }

  const modulePath = modulePathFromSlug(slug);
  const previousBranch = getCurrentBranch();
  const didStash = stash();

  try {
    exec(`git checkout ${branchName}`);

    // Read pipeline meta to determine mode for stage validation
    const pipelineMeta = readPipelineMetaFromBranch(branchName, modulePath);
    const mode = pipelineMeta?.mode;

    // Validate stage order
    const commits = getCommitsForBranch(branchName);
    const nextAllowed = getNextStage(commits, mode);

    if (nextAllowed !== stage) {
      throw new Error(
        `Stage '${stage}' not allowed. Next required stage: '${nextAllowed}'. ` +
          `Complete previous stages first.`,
      );
    }

    // Execute stage-specific side-effect
    await runSideEffect(stage, slug, modulePath, branchName, options);

    // Stage files
    if (stage === 'push-for-review') {
      const absModulePath = path.join(REPO_ROOT, modulePath);
      fs.writeFileSync(
        path.join(absModulePath, '.pushed'),
        `Pushed for review at ${new Date().toISOString()}\n`,
      );
      exec(`git add ${modulePath}`);
    } else {
      exec(`git add ${modulePath}`);
    }

    // Also stage output files for implementation-started
    if (stage === 'implementation-started') {
      exec('git add script/spec-gen-kit/output/', { allowFailure: true });
    }

    // Create the commit
    const message = stageCommitMessage(stage, slug, options);
    exec(`git commit -m "${message.replace(/"/g, '\\"')}" --allow-empty`);

    const hash = exec('git rev-parse HEAD');

    return {
      hash,
      message,
      stage,
      date: new Date().toISOString(),
      author: exec('git config user.name', { allowFailure: true }) || 'unknown',
    };
  } finally {
    if (previousBranch !== branchName) {
      exec(`git checkout ${previousBranch}`, { allowFailure: true });
    }
    if (didStash) unstash();
  }
}

function stageCommitMessage(
  stage: PipelineStage,
  slug: string,
  options?: Partial<CommitRequest>,
): string {
  const opts = options as Record<string, unknown> | undefined;
  switch (stage) {
    case 'init': {
      const mode = (opts?._mode as string) || 'reverse-and-forwards';
      return `[init] Initialize module (${mode}): ${slug}`;
    }
    case 'prompt-ready':
      return `[prompt-ready] Extraction prompt committed for: ${slug}`;
    case 'generate-spec':
      return `[generate-spec] Spec generated for: ${slug}`;
    case 'make-implement':
      return `[make-implement] Implementation prompt created for: ${slug}`;
    case 'implementation-started':
      return `[implementation-started] Job submitted for: ${slug}`;
    case 'implementation-complete':
      return `[implementation-complete] Ready for review: ${slug}`;
    case 'push-for-review':
      return `[push-for-review] Pushed for review: ${slug}`;
  }
}

async function runSideEffect(
  stage: PipelineStage,
  slug: string,
  modulePath: string,
  branchName: string,
  options?: Partial<CommitRequest>,
): Promise<void> {
  const absModulePath = path.join(REPO_ROOT, modulePath);
  const opts = options as Record<string, unknown> | undefined;

  switch (stage) {
    case 'init': {
      const mode = (opts?._mode as PipelineMode) || 'reverse-and-forwards';
      const sourceModulePath = opts?._sourceModulePath as string | undefined;
      const sourceModuleName = (opts?._sourceModuleName as string) || '';
      const sourceHasSpec = (opts?._sourceHasSpec as boolean) || false;

      // Create module directory
      fs.mkdirSync(absModulePath, { recursive: true });

      // Write placeholder page.tsx
      const componentName = slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('');
      fs.writeFileSync(
        path.join(absModulePath, 'page.tsx'),
        [
          `export default function ${componentName}Page() {`,
          `  return <div>Prototype: ${slug}</div>`,
          `}`,
          ``,
        ].join('\n'),
      );

      // Write pipeline.json
      const pipelineMeta: PipelineMeta = {
        mode,
        sourceModule: {
          name: sourceModuleName,
          path: sourceModulePath || '',
          hasSpec: sourceHasSpec,
        },
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(
        path.join(absModulePath, 'pipeline.json'),
        JSON.stringify(pipelineMeta, null, 2) + '\n',
      );

      // Handle spec copying based on mode
      if (sourceModulePath && sourceHasSpec) {
        const absSourcePath = path.isAbsolute(sourceModulePath)
          ? sourceModulePath
          : path.join(REPO_ROOT, sourceModulePath);
        const sourceSpecPath = path.join(absSourcePath, 'SPEC.md');

        if (mode === 'forwards-only') {
          // Copy source SPEC.md directly as the new module's SPEC.md
          fs.copyFileSync(sourceSpecPath, path.join(absModulePath, 'SPEC.md'));
        } else {
          // reverse-and-forwards: copy as spec-parent.md + write lineage.json
          fs.copyFileSync(sourceSpecPath, path.join(absModulePath, 'spec-parent.md'));
          const lineage: LineageInfo = {
            parentSpec: `${sourceModulePath}/SPEC.md`,
            parentModule: sourceModulePath,
            childSpec: `${modulePath}/SPEC.md`,
            createdAt: new Date().toISOString(),
          };
          fs.writeFileSync(
            path.join(absModulePath, 'lineage.json'),
            JSON.stringify(lineage, null, 2) + '\n',
          );
        }
      }
      break;
    }

    case 'prompt-ready': {
      // Write the extraction prompt to the module directory
      const prompt = opts?._prompt as string | undefined;
      if (!prompt) {
        throw new Error('prompt-ready requires opts._prompt');
      }
      fs.mkdirSync(absModulePath, { recursive: true });
      fs.writeFileSync(
        path.join(absModulePath, 'extraction-prompt.md'),
        prompt,
        'utf-8',
      );
      break;
    }

    case 'generate-spec': {
      // If spec content was passed in memory (robust against branch switches),
      // write it to disk. Otherwise fall back to checking if it already exists.
      const specContent = opts?._specContent as string | undefined;
      if (specContent) {
        fs.mkdirSync(absModulePath, { recursive: true });
        fs.writeFileSync(path.join(absModulePath, 'SPEC.md'), specContent, 'utf-8');
      } else if (!fs.existsSync(path.join(absModulePath, 'SPEC.md'))) {
        throw new Error('SPEC.md not found. Run generation first or retry.');
      }
      break;
    }

    case 'make-implement': {
      // Write boilerplate implement.md into the module directory
      fs.mkdirSync(absModulePath, { recursive: true });
      const implementContent = [
        `We are working on \`@${modulePath}\`.`,
        '',
        `Please first study \`@${modulePath}/SPEC.md\`, then implement the requirement specified there into the working directory.`,
        '',
      ].join('\n');
      fs.writeFileSync(
        path.join(absModulePath, 'implement.md'),
        implementContent,
        'utf-8',
      );
      break;
    }

    case 'implementation-started': {
      // Read implement.md from the module directory (created by make-implement stage)
      const implementPath = path.join(absModulePath, 'implement.md');
      if (!fs.existsSync(implementPath)) {
        throw new Error('implement.md not found. Run make-implement stage first.');
      }
      const prompt = fs.readFileSync(implementPath, 'utf-8');

      // Write generated prompt to output (for debugging)
      writeOutput('implement-prompt.md', prompt);

      // Enqueue job via the real worker queue API
      const enqueueRes = await fetch('http://localhost:3002/api/jobs/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          name: slug,
          branch: branchName,
        }),
      });

      if (!enqueueRes.ok) {
        const errBody = await enqueueRes.text();
        throw new Error(`Failed to enqueue job: ${enqueueRes.status} ${errBody}`);
      }

      const enqueueData = await enqueueRes.json() as { success: boolean; job: { id: string } };
      if (!enqueueData.success || !enqueueData.job?.id) {
        throw new Error('Enqueue response missing job ID');
      }

      const jobId = enqueueData.job.id;

      // Write implementation-started marker with worker job ID
      fs.writeFileSync(
        path.join(absModulePath, '.implementation-started'),
        JSON.stringify({ jobId, startedAt: new Date().toISOString() }, null, 2) + '\n',
      );
      break;
    }

    case 'implementation-complete': {
      // Write .complete marker
      fs.writeFileSync(
        path.join(absModulePath, '.complete'),
        `Implementation completed at ${new Date().toISOString()}\n`,
      );
      break;
    }

    case 'push-for-review': {
      // Push and PR are handled after the commit in a separate flow
      break;
    }
  }
}

// --- Push and PR ---

export function pushBranch(branchName: string): string {
  return exec(`git push -u origin ${branchName}`);
}

export function createPullRequest(
  branchName: string,
  title: string,
  body?: string,
): { url: string; stubbed: boolean } {
  try {
    exec('which gh');
    const bodyArg = body
      ? ` --body "${body.replace(/"/g, '\\"')}"`
      : ' --body ""';
    const url = exec(
      `gh pr create --base ${BASE_BRANCH} --head ${branchName} --title "${title.replace(/"/g, '\\"')}"${bodyArg}`,
    );
    return { url, stubbed: false };
  } catch {
    return {
      url: `(stubbed) https://github.com/your-org/your-repo/compare/${BASE_BRANCH}...${branchName}?title=${encodeURIComponent(title)}`,
      stubbed: true,
    };
  }
}

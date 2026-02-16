import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as path from 'path';
import { saveManifest } from '../../lib/manifest';
import { createBranch } from '../../lib/pipeline';
import type { ApiResponse, Manifest, ManifestEntry, PrototypeBranch } from '../../pipeline-types';

const BRANCH_PREFIX = 'prototype';

function branchExists(slug: string): boolean {
  try {
    const result = execSync(
      `git branch --list "${BRANCH_PREFIX}/${slug}"`,
      { cwd: process.cwd(), encoding: 'utf-8' },
    ).trim();
    return !!result;
  } catch {
    return false;
  }
}

function findAvailableSlug(baseSlug: string): string {
  if (!branchExists(baseSlug)) return baseSlug;
  let suffix = 2;
  while (branchExists(`${baseSlug}-${suffix}`)) {
    suffix++;
  }
  return `${baseSlug}-${suffix}`;
}

function deriveSourceModulePath(componentPath: string): string {
  const dir = path.dirname(componentPath);
  return dir || 'src/app/modules';
}

export async function POST(
  req: NextRequest,
): Promise<NextResponse<ApiResponse<{ manifest: Manifest; branches: PrototypeBranch[] }>>> {
  try {
    const body = await req.json();
    const { entries } = body as { entries: ManifestEntry[] };

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { ok: false, error: 'Missing required field: entries (array)' },
        { status: 400 },
      );
    }

    const manifest: Manifest = {
      createdAt: new Date().toISOString(),
      entries,
    };
    saveManifest(manifest);

    const enabledEntries = entries.filter((e) => e.enabled);
    const branches: PrototypeBranch[] = [];

    for (const entry of enabledEntries) {
      const slug = findAvailableSlug(entry.slug);
      if (slug !== entry.slug) {
        entry.slug = slug;
      }

      const sourceModulePath = deriveSourceModulePath(entry.componentPath);

      try {
        const branch = await createBranch(
          slug,
          sourceModulePath,
          'reverse-and-forwards',
        );
        branches.push(branch);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to create branch for ${slug}: ${message}`);
      }
    }

    saveManifest(manifest);

    return NextResponse.json({ ok: true, data: { manifest, branches } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

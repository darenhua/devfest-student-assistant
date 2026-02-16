import fs from 'fs';
import path from 'path';
import type { ManifestEntry, Manifest, OverlayItem } from '../pipeline-types';

const OUTPUT_DIR = path.join(process.cwd(), 'script', 'spec-gen-kit', 'output');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');

// --- Overlay → Manifest transformation ---

function slugify(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseSourceInfo(content: string): { filePath: string; lineNumber: number | null } | null {
  const match = content.match(
    /\n\s+in\s+(?:\S+\s+\(at\s+)?([^):]+\.\w{1,4})(?::(\d+))?/
  );
  if (!match) return null;
  return {
    filePath: match[1],
    lineNumber: match[2] ? parseInt(match[2], 10) : null,
  };
}

export function parseOverlayItems(items: OverlayItem[]): ManifestEntry[] {
  return items
    .filter((item) => item.isComment && item.commentText)
    .map((item) => {
      const sourceInfo = parseSourceInfo(item.content);
      const componentName = item.componentName || item.elementName;
      const slug = slugify(componentName);

      return {
        id: item.id,
        componentPath: sourceInfo?.filePath || '',
        lineNumber: sourceInfo?.lineNumber ?? null,
        componentName,
        context: item.commentText || '',
        slug,
        enabled: true,
      };
    });
}

// --- Manifest file I/O ---

export function saveManifest(manifest: Manifest): void {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

export function loadManifest(): Manifest | null {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return null;
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

export function getManifestEntryForSlug(slug: string): ManifestEntry | null {
  const manifest = loadManifest();
  if (!manifest) return null;
  return manifest.entries.find((e) => e.slug === slug) ?? null;
}

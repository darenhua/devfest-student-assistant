import fs from 'fs';
import path from 'path';

// Templates live in script/spec-gen-kit/templates (read-only source)
const TEMPLATES_DIR = path.join(process.cwd(), 'script', 'spec-gen-kit', 'templates');

// --- Template reading ---

export function readTemplate(templateName: string): string {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateName}`);
  }
  return fs.readFileSync(templatePath, 'utf-8');
}

// --- Placeholder substitution ---

export function substituteTemplate(
  template: string,
  substitutions: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(substitutions)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

// --- Output writing (writes to the MODULE folder, not script/spec-gen-kit) ---

export function writeOutput(filename: string, content: string, moduleDir: string): string {
  const absDir = path.isAbsolute(moduleDir)
    ? moduleDir
    : path.join(process.cwd(), moduleDir);
  fs.mkdirSync(absDir, { recursive: true });
  const outputPath = path.join(absDir, filename);
  fs.writeFileSync(outputPath, content, 'utf-8');
  return outputPath;
}

// --- Module listing ---

export function listModules(projectRoot: string): { name: string; path: string; hasSpec: boolean }[] {
  const absPath = path.isAbsolute(projectRoot)
    ? projectRoot
    : path.join(process.cwd(), projectRoot);

  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    throw new Error(`Directory not found: ${projectRoot}`);
  }

  const entries = fs.readdirSync(absPath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({
      name: e.name,
      path: path.join(projectRoot, e.name),
      hasSpec: fs.existsSync(path.join(absPath, e.name, 'SPEC.md')),
    }));
}

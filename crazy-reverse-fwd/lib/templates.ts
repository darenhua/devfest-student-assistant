import fs from 'fs';
import path from 'path';

// Paths relative to project root
const SCRIPT_DIR = path.join(process.cwd(), 'script', 'spec-gen-kit');
const TEMPLATES_DIR = path.join(SCRIPT_DIR, 'templates');
const OUTPUT_DIR = path.join(SCRIPT_DIR, 'output');

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

// --- Output writing ---

export function writeOutput(filename: string, content: string): string {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, filename);
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

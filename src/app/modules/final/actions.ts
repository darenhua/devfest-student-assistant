"use server";

import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import type {
  EventItem,
  HomeworkItem,
  OfficeHourItem,
  ExamItem,
} from "./components/types";

const LINKS_PATH = join(
  process.cwd(),
  "src/app/prototypes/testin-ext-sources/server/LINKS.json",
);
const EVENTS_PATH = join(
  process.cwd(),
  "src/app/prototypes/dedalus-event-scraping/server/events.json",
);
const CANVAS_PATH = join(
  process.cwd(),
  "src/app/prototypes/testin-canvas/server/canvas_cache.json",
);
const FINDINGS_PATH = join(
  process.cwd(),
  "src/app/prototypes/testin-ext-sources/server/findings_cache.json",
);

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

async function readJson(path: string): Promise<any> {
  try {
    const text = await readFile(path, "utf-8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

interface Finding {
  type: string;
  title: string;
  description?: string;
  source_url?: string;
  due_date?: string;
  time_info?: string;
  location?: string;
}

function parseFindingsCache(raw: any): Finding[] {
  if (!raw?.findings || !Array.isArray(raw.findings)) return [];
  const result: Finding[] = [];
  for (const entry of raw.findings) {
    if (typeof entry.findings === "string") {
      try {
        const parsed = JSON.parse(entry.findings);
        if (Array.isArray(parsed)) result.push(...parsed);
      } catch {
        /* skip malformed */
      }
    } else if (entry.type) {
      result.push(entry);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Data getters
// ---------------------------------------------------------------------------

export async function getEventItems(): Promise<EventItem[]> {
  const data = await readJson(EVENTS_PATH);
  if (!Array.isArray(data)) return [];

  return data.map((e: any) => ({
    id: e.id || crypto.randomUUID(),
    title: e.summary || "Untitled Event",
    timeLabel: `${e.calendar?.shortLabel || ""} \u00b7 ${e.calendar?.timeRange || ""}`.trim(),
    location: e.location?.address || "",
    sourceUrl: e.eventlink || "",
    source: "columbia-events" as const,
  }));
}

export async function getHomeworkItems(): Promise<HomeworkItem[]> {
  const items: HomeworkItem[] = [];

  const canvas = await readJson(CANVAS_PATH);
  if (canvas) {
    const courses: Record<number, string> = {};
    if (Array.isArray(canvas.courses)) {
      for (const c of canvas.courses) {
        courses[c.id] = c.name || c.course_code || "Unknown Course";
      }
    }
    if (Array.isArray(canvas.assignments)) {
      for (const a of canvas.assignments) {
        items.push({
          id: `canvas-${a.id}`,
          title: a.name || "Untitled Assignment",
          className: courses[a.course_id] || "Unknown Course",
          dueDate: a.due_at
            ? new Date(a.due_at).toLocaleDateString()
            : "No due date",
          sourceUrl:
            a.html_url ||
            `https://courseworks2.columbia.edu/courses/${a.course_id}/assignments/${a.id}`,
          sourceName: "Canvas",
          source: "canvas",
        });
      }
    }
  }

  const findingsRaw = await readJson(FINDINGS_PATH);
  const findings = parseFindingsCache(findingsRaw);
  let hwIdx = 0;
  for (const f of findings) {
    if (f.type !== "homework") continue;
    items.push({
      id: `ext-hw-${hwIdx++}-${f.title?.replace(/\s+/g, "-").toLowerCase() || "unknown"}`,
      title: f.title || "Untitled",
      className: "",
      dueDate: f.due_date || "No due date",
      sourceUrl: f.source_url || "",
      sourceName: "Web",
      source: "ext-sources",
    });
  }

  return items;
}

export async function getOfficeHourItems(): Promise<OfficeHourItem[]> {
  const findingsRaw = await readJson(FINDINGS_PATH);
  const findings = parseFindingsCache(findingsRaw);

  return findings
    .filter((f) => f.type === "office_hours")
    .map((f, i) => ({
      id: `oh-${i}-${f.title?.replace(/\s+/g, "-").toLowerCase() || "unknown"}`,
      label: f.title || "Office Hours",
      timeInfo: f.time_info || "",
      location: f.location || "",
      sourceUrl: f.source_url || "",
      source: "ext-sources" as const,
    }));
}

export async function getExamItems(): Promise<ExamItem[]> {
  const findingsRaw = await readJson(FINDINGS_PATH);
  const findings = parseFindingsCache(findingsRaw);

  return findings
    .filter((f) => f.type === "exam")
    .map((f, i) => ({
      id: `exam-${i}-${f.title?.replace(/\s+/g, "-").toLowerCase() || "unknown"}`,
      title: f.title || "Exam",
      timeInfo: f.time_info || "",
      location: f.location || "",
      sourceUrl: f.source_url || "",
      source: "ext-sources" as const,
    }));
}

// ---------------------------------------------------------------------------
// Source management
// ---------------------------------------------------------------------------

export interface SourceEntry {
  id: string;
  url: string;
  label: string;
  addedAt: string;
}

export async function getSources(): Promise<SourceEntry[]> {
  try {
    const text = await readFile(LINKS_PATH, "utf-8");
    const links = JSON.parse(text);
    if (!Array.isArray(links)) return [];
    return links;
  } catch {
    return [];
  }
}

export async function addSource(url: string, label: string) {
  let links: any[] = [];
  try {
    const text = await readFile(LINKS_PATH, "utf-8");
    links = JSON.parse(text);
    if (!Array.isArray(links)) links = [];
  } catch {
    links = [];
  }

  const host = new URL(url).hostname.replace(/\./g, "-");
  const entry = {
    id: `${host}-${Date.now()}`,
    url,
    label,
    addedAt: new Date().toISOString(),
  };

  links.push(entry);
  await writeFile(LINKS_PATH, JSON.stringify(links, null, 2) + "\n");
  return entry;
}

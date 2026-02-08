"use server";

import { readFile } from "fs/promises";
import { join } from "path";
import type { CanvasCache } from "./types";

const CACHE_FILE = join(process.cwd(), "src/app/prototypes/testin-canvas/server/canvas_cache.json");

const EMPTY_CACHE: CanvasCache = { courses: [], assignments: [], todos: [], lastUpdated: null };

export async function getCanvasCache(): Promise<CanvasCache> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : EMPTY_CACHE;
  } catch {
    return EMPTY_CACHE;
  }
}

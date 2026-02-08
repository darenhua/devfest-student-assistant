"use server";

import { readFile } from "fs/promises";
import { join } from "path";
import type { CleanEvent } from "./types";

const EVENTS_FILE = join(process.cwd(), "src/app/prototypes/testin-events/server/events.json");

export async function getEvents(): Promise<CleanEvent[]> {
  try {
    const raw = await readFile(EVENTS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

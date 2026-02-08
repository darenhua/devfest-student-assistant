"use server";

import { readFile } from "fs/promises";
import { join } from "path";
import type { FindingsCache, SourceLink } from "./types";

const BASE = join(process.cwd(), "src/app/prototypes/testin-ext-sources/server");
const CACHE_FILE = join(BASE, "findings_cache.json");
const LINKS_FILE = join(BASE, "LINKS.json");

const EMPTY_CACHE: FindingsCache = { findings: [], crawlLog: [], lastUpdated: null };

export async function getFindingsCache(): Promise<FindingsCache> {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : EMPTY_CACHE;
  } catch {
    return EMPTY_CACHE;
  }
}

export async function getSourceLinks(): Promise<SourceLink[]> {
  try {
    const raw = await readFile(LINKS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

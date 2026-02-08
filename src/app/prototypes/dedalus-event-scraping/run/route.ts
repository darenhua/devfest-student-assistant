import { NextResponse } from "next/server";
import Dedalus from "dedalus-labs";
import { DedalusRunner } from "dedalus-labs";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// ---------------------------------------------------------------------------
// Events JSON file path (lives next to the MCP server)
// ---------------------------------------------------------------------------

const EVENTS_FILE = join(
  process.cwd(),
  "src/app/prototypes/dedalus-event-scraping/server/events.json"
);

const COLUMBIA_EVENTS_URL =
  "https://events.columbia.edu/feeder/main/eventsFeed.do" +
  "?f=y&sort=dtstart.utc:asc" +
  "&fexpr=(categories.href!=%22/public/.bedework/categories/sys/Ongoing%22)" +
  "%20and%20(categories.href=%22/public/.bedework/categories/org/UniversityEvents%22)" +
  "%20and%20(entity_type=%22event%22%7Centity_type=%22todo%22)" +
  "&skinName=list-json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function decodeEntities(text: string): string {
  return text.replace(/&amp;/g, "&").replace(/&#39;/g, "'");
}

function hashId(input: string): string {
  // Simple hash — deterministic 12-char hex ID
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(12, "0").slice(0, 12);
}

function cleanEvent(raw: any): any {
  const start = raw.start || {};
  const end = raw.end || {};
  const location = raw.location || {};

  const dayName = (start.dayname || "").slice(0, 3);
  const shortDate = start.shortdate || "";
  const datePart = shortDate.replace(/\/\d{2}$/, "");
  const allDay = start.allday === "true";
  const timeRange = allDay
    ? "All day"
    : `${start.time || ""} - ${end.time || ""}`;

  const rawId = raw.guid || raw.eventlink || "";

  return {
    id: hashId(rawId),
    summary: decodeEntities(raw.summary || ""),
    link: raw.link || "",
    eventlink: raw.eventlink || "",
    startDate: raw.startDate || "",
    endDate: raw.endDate || "",
    location: {
      address: (location.address || "").replace(/\t/g, " "),
      mapLink: location.link || "",
    },
    description: stripHtml(raw.description || ""),
    calendar: {
      shortLabel: `${dayName} ${datePart}`,
      timeRange,
      timezone: start.timezone || "",
      allDay,
    },
  };
}

function readEvents(): any[] {
  if (!existsSync(EVENTS_FILE)) return [];
  try {
    const data = JSON.parse(readFileSync(EVENTS_FILE, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeEvents(events: any[]): void {
  const dir = dirname(EVENTS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
}

// ---------------------------------------------------------------------------
// Local tools — the functions the LLM agent can call
// ---------------------------------------------------------------------------

async function fetch_columbia_events(
  days: number = 14,
  count: number = 50
): Promise<Record<string, any>> {
  const d = typeof days === "object" ? (days as any).days ?? 14 : days;
  const c = typeof count === "object" ? (count as any).count ?? 50 : count;

  const url = `${COLUMBIA_EVENTS_URL}&count=${c}&days=${d}`;
  const resp = await fetch(url);
  if (!resp.ok) return { error: `Fetch failed: ${resp.status}` };
  const data = await resp.json();

  const rawEvents = data?.bwEventList?.events || [];
  const cleanEvents = rawEvents.map(cleanEvent);

  // Merge with existing (upsert by id)
  const existing = readEvents();
  const existingIds = new Set(existing.map((e: any) => e.id));

  let newCount = 0;
  for (const event of cleanEvents) {
    if (!existingIds.has(event.id)) {
      existing.push(event);
      existingIds.add(event.id);
      newCount++;
    }
  }

  writeEvents(existing);

  return {
    fetched: rawEvents.length,
    cleaned: cleanEvents.length,
    new_events_added: newCount,
    total_stored: existing.length,
    events: cleanEvents,
  };
}

function get_events(): any[] {
  return readEvents();
}

function get_event(event_id: string): any {
  const id =
    typeof event_id === "object" ? (event_id as any).event_id : event_id;
  const events = readEvents();
  const found = events.find((e: any) => e.id === id);
  return found || { error: `Event with id '${id}' not found` };
}

function delete_event(event_id: string): any {
  const id =
    typeof event_id === "object" ? (event_id as any).event_id : event_id;
  const events = readEvents();
  const filtered = events.filter((e: any) => e.id !== id);
  if (filtered.length === events.length) {
    return { error: `Event with id '${id}' not found` };
  }
  writeEvents(filtered);
  return { deleted: id, remaining: filtered.length };
}

function update_event(event_id: string, updates_json: string): any {
  const id =
    typeof event_id === "object" ? (event_id as any).event_id : event_id;
  const json =
    typeof updates_json === "object"
      ? (updates_json as any).updates_json
      : updates_json;

  let updates: any;
  try {
    updates = JSON.parse(json);
  } catch {
    return { error: "updates_json must be valid JSON" };
  }

  const events = readEvents();
  const event = events.find((e: any) => e.id === id);
  if (!event) return { error: `Event with id '${id}' not found` };

  delete updates.id;
  Object.assign(event, updates);
  writeEvents(events);
  return { updated: id, event };
}

function add_event(event_json: string): any {
  const json =
    typeof event_json === "object"
      ? (event_json as any).event_json
      : event_json;

  let event: any;
  try {
    event = JSON.parse(json);
  } catch {
    return { error: "event_json must be valid JSON" };
  }

  const required = ["summary", "startDate", "endDate"];
  const missing = required.filter((f) => !(f in event));
  if (missing.length) {
    return { error: `Missing required fields: ${missing.join(", ")}` };
  }

  if (!event.id) {
    event.id = hashId(`${event.summary}${event.startDate}`);
  }

  const events = readEvents();
  events.push(event);
  writeEvents(events);
  return { added: event.id, total: events.length, event };
}

// ---------------------------------------------------------------------------
// POST /prototypes/dedalus-event-scraping/run
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userPrompt =
      body.prompt ||
      "Fetch upcoming Columbia events and return a summary of what you found.";

    const client = new Dedalus();
    const runner = new DedalusRunner(client);

    const result = await runner.run({
      input: userPrompt,
      model: "anthropic/claude-sonnet-4-20250514",
      tools: [
        fetch_columbia_events,
        get_events,
        get_event,
        delete_event,
        update_event,
        add_event,
      ],
    });

    return NextResponse.json({
      success: true,
      output: (result as any).finalOutput,
      model: "anthropic/claude-sonnet-4-20250514",
      localTools: [
        "fetch_columbia_events",
        "get_events",
        "get_event",
        "delete_event",
        "update_event",
        "add_event",
      ],
    });
  } catch (error: any) {
    console.error("Dedalus runner error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        hint: "Make sure DEDALUS_API_KEY is set in your .env.local file",
      },
      { status: 500 }
    );
  }
}

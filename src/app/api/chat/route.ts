import { NextResponse } from "next/server";
import Dedalus from "dedalus-labs";
import { DedalusRunner } from "dedalus-labs";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type McpSource = "canvas" | "external" | "events";

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// MCP Bridge (copied inline from prototype routes)
// ---------------------------------------------------------------------------

let mcpRequestId = 1;

async function mcpJsonRpc(
  url: string,
  method: string,
  params?: unknown,
): Promise<unknown> {
  const id = mcpRequestId++;
  const body = {
    jsonrpc: "2.0",
    method,
    id,
    ...(params !== undefined ? { params } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP server returned ${res.status}: ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));
        if (data.id === id || data.result || data.error) {
          if (data.error)
            throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
          return data.result;
        }
      }
    }
    throw new Error(`No matching response in SSE stream for id=${id}`);
  }

  const data = await res.json();
  if (data.error)
    throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function discoverMcpTools(url: string): Promise<McpTool[]> {
  await mcpJsonRpc(url, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "chat-mcp-bridge", version: "0.1.0" },
  });

  try {
    await mcpJsonRpc(url, "notifications/initialized");
  } catch {
    // notifications may not return a response
  }

  const result = (await mcpJsonRpc(url, "tools/list")) as {
    tools: McpTool[];
  };
  return result.tools;
}

async function callMcpTool(
  url: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return mcpJsonRpc(url, "tools/call", {
    name: toolName,
    arguments: args,
  });
}

const MAX_TOOL_RESULT_CHARS = 30_000;

function extractMcpResult(result: any): string {
  let text: string;
  if (result?.content) {
    const texts = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text);
    text = texts.length === 1 ? texts[0] : texts.join("\n");
  } else {
    text = JSON.stringify(result);
  }

  if (text.length > MAX_TOOL_RESULT_CHARS) {
    text =
      text.slice(0, MAX_TOOL_RESULT_CHARS) +
      "\n\n[... truncated — result too large]";
  }
  return text;
}

function createMcpToolWrappers(url: string, mcpTools: McpTool[]) {
  return mcpTools.map((tool) => {
    const schema = tool.inputSchema as any;
    const props = schema?.properties || {};
    const paramNames: string[] = Object.keys(props);

    const handler = async (argsObj: Record<string, unknown>) => {
      const result = await callMcpTool(url, tool.name, argsObj);
      return extractMcpResult(result);
    };

    let fn: Function;

    if (paramNames.length === 0) {
      fn = async function () {
        return handler({});
      };
    } else {
      const argsList = paramNames.join(", ");
      const argsObjLiteral = paramNames
        .map((p) => `"${p}": ${p}`)
        .join(", ");

      fn = new Function(
        "__handler",
        `return async function ${tool.name}(${argsList}) { return __handler({${argsObjLiteral}}); }`,
      )(handler);
    }

    Object.defineProperty(fn, "name", { value: tool.name });
    return fn;
  });
}

// ---------------------------------------------------------------------------
// Events local tools (copied from dedalus-event-scraping)
// ---------------------------------------------------------------------------

const EVENTS_FILE = join(
  process.cwd(),
  "src/app/prototypes/dedalus-event-scraping/server/events.json",
);

const COLUMBIA_EVENTS_URL =
  "https://events.columbia.edu/feeder/main/eventsFeed.do" +
  "?f=y&sort=dtstart.utc:asc" +
  "&fexpr=(categories.href!=%22/public/.bedework/categories/sys/Ongoing%22)" +
  "%20and%20(categories.href=%22/public/.bedework/categories/org/UniversityEvents%22)" +
  "%20and%20(entity_type=%22event%22%7Centity_type=%22todo%22)" +
  "&skinName=list-json";

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

async function fetch_columbia_events(
  days: number = 14,
  count: number = 50,
): Promise<Record<string, any>> {
  const d = typeof days === "object" ? (days as any).days ?? 14 : days;
  const c = typeof count === "object" ? (count as any).count ?? 50 : count;

  const url = `${COLUMBIA_EVENTS_URL}&count=${c}&days=${d}`;
  const resp = await fetch(url);
  if (!resp.ok) return { error: `Fetch failed: ${resp.status}` };
  const data = await resp.json();

  const rawEvents = data?.bwEventList?.events || [];
  const cleanEvents = rawEvents.map(cleanEvent);

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

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------

const MCP_URLS: Record<Exclude<McpSource, "events">, string> = {
  canvas: "http://localhost:8002/mcp",
  external: "http://localhost:8003/mcp",
};

export async function POST(request: Request) {
  const tag = `[chat ${Date.now()}]`;
  try {
    const body = await request.json();
    const prompt: string = body.prompt || "";
    const mcpSources: McpSource[] = body.mcpSources || [
      "canvas",
      "external",
      "events",
    ];

    if (!prompt.trim()) {
      return NextResponse.json(
        { success: false, error: "prompt is required" },
        { status: 400 },
      );
    }

    console.log(`${tag} prompt: ${prompt.slice(0, 120)}`);
    console.log(`${tag} sources: ${mcpSources.join(", ")}`);

    // Collect all tools
    const allTools: Function[] = [];
    const toolNames: string[] = [];
    const errors: string[] = [];

    // Bridge MCP sources (canvas, external)
    for (const source of mcpSources) {
      if (source === "events") continue;

      const mcpUrl = MCP_URLS[source];
      try {
        const mcpTools = await discoverMcpTools(mcpUrl);
        const wrappers = createMcpToolWrappers(mcpUrl, mcpTools);
        allTools.push(...wrappers);
        toolNames.push(...mcpTools.map((t) => `${t.name} (${source})`));
      } catch (err: any) {
        console.warn(
          `${tag} Could not connect to ${source} MCP at ${mcpUrl}: ${err.message}`,
        );
        errors.push(`${source}: ${err.message}`);
      }
    }

    // Local events tools
    if (mcpSources.includes("events")) {
      allTools.push(fetch_columbia_events, get_events, get_event);
      toolNames.push(
        "fetch_columbia_events (events)",
        "get_events (events)",
        "get_event (events)",
      );
    }

    if (allTools.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No tools available. MCP servers may be offline.",
          details: errors,
        },
        { status: 502 },
      );
    }

    // Build system instructions
    const sourceList = mcpSources.join(", ");
    const instructions = [
      `You are a school assistant for a Columbia University student.`,
      `You have access to these data sources: ${sourceList}.`,
      `Available tools: ${toolNames.join(", ")}.`,
      mcpSources.includes("canvas")
        ? `For Canvas: use list_courses to see courses, list_assignments for assignments, get_syllabus for syllabi, get_upcoming_events for deadlines.`
        : "",
      mcpSources.includes("external")
        ? `For External sources: use list_sources to see configured URLs, crawl_source or crawl_all_sources to scan websites, list_findings to see saved findings.`
        : "",
      mcpSources.includes("events")
        ? `For Events: use fetch_columbia_events to fetch upcoming Columbia events, get_events to list stored events.`
        : "",
      `Answer the student's question using the available tools. Be concise and helpful.`,
    ]
      .filter(Boolean)
      .join(" ");

    console.log(`${tag} Running with ${allTools.length} tools`);

    const client = new Dedalus();
    const runner = new DedalusRunner(client);

    const startTime = Date.now();
    const result = await runner.run({
      input: prompt,
      model: "anthropic/claude-sonnet-4-20250514",
      instructions,
      tools: allTools as any,
      maxSteps: 15,
    });
    const elapsed = Date.now() - startTime;

    const r = result as any;
    console.log(`${tag} Done in ${elapsed}ms`);

    return NextResponse.json({
      success: true,
      output: r.finalOutput,
      toolsCalled: r.toolsCalled || r.tools_called || [],
      mcpSources,
      _debug: { elapsed, errors },
    });
  } catch (error: any) {
    console.error(`${tag} Error:`, error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}

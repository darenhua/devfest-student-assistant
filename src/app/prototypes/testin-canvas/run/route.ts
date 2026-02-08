import { NextResponse } from "next/server";
import Dedalus from "dedalus-labs";
import { DedalusRunner } from "dedalus-labs";

// ---------------------------------------------------------------------------
// MCP Bridge — same pattern as testin-events prototype.
// Discovers MCP tools via JSON-RPC, wraps them as local functions for the
// Dedalus runner (which can't reach localhost MCP servers directly).
// ---------------------------------------------------------------------------

type McpTool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

let mcpRequestId = 1;

async function mcpJsonRpc(url: string, method: string, params?: unknown): Promise<unknown> {
  const id = mcpRequestId++;
  const body = { jsonrpc: "2.0", method, id, ...(params !== undefined ? { params } : {}) };

  console.log(`[canvas-mcp-bridge] --> ${method} (id=${id})`);
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
          if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
          return data.result;
        }
      }
    }
    throw new Error(`No matching response in SSE stream for id=${id}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function discoverMcpTools(url: string): Promise<McpTool[]> {
  console.log(`[canvas-mcp-bridge] Initializing MCP session at ${url}`);

  await mcpJsonRpc(url, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "canvas-mcp-bridge", version: "0.1.0" },
  });

  try {
    await mcpJsonRpc(url, "notifications/initialized");
  } catch {
    // notifications may not return a response
  }

  const result = (await mcpJsonRpc(url, "tools/list")) as { tools: McpTool[] };
  console.log(`[canvas-mcp-bridge] Discovered ${result.tools.length} tools: ${result.tools.map((t) => t.name).join(", ")}`);
  return result.tools;
}

async function callMcpTool(url: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  console.log(`[canvas-mcp-bridge] Calling MCP tool: ${toolName}(${JSON.stringify(args)})`);
  const result = await mcpJsonRpc(url, "tools/call", { name: toolName, arguments: args });
  console.log(`[canvas-mcp-bridge] MCP tool ${toolName} result: ${JSON.stringify(result).slice(0, 200)}`);
  return result;
}

const MAX_TOOL_RESULT_CHARS = 30_000; // ~30 KB per tool result to stay within context limits

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
    console.log(`[canvas-mcp-bridge] Truncating tool result from ${text.length} to ${MAX_TOOL_RESULT_CHARS} chars`);
    text = text.slice(0, MAX_TOOL_RESULT_CHARS) + "\n\n[... truncated — result too large]";
  }
  return text;
}

function createMcpToolWrappers(url: string, mcpTools: McpTool[]) {
  return mcpTools.map((tool) => {
    const schema = tool.inputSchema as any;
    const props = schema?.properties || {};
    const paramNames: string[] = Object.keys(props);

    console.log(`[canvas-mcp-bridge] Creating wrapper for ${tool.name}(${paramNames.join(", ")})`);

    const handler = async (argsObj: Record<string, unknown>) => {
      console.log(`[canvas-mcp-bridge] Wrapper ${tool.name} called with:`, JSON.stringify(argsObj));
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
      const argsObjLiteral = paramNames.map((p) => `"${p}": ${p}`).join(", ");

      fn = new Function(
        "__handler",
        `return async function ${tool.name}(${argsList}) { return __handler({${argsObjLiteral}}); }`
      )(handler);
    }

    Object.defineProperty(fn, "name", { value: tool.name });

    return { fn, meta: tool };
  });
}

// ---------------------------------------------------------------------------
// POST /prototypes/testin-canvas/run
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const tag = `[canvas-mcp ${Date.now()}]`;
  try {
    const body = await request.json();
    const userPrompt = body.prompt || "List all my active courses.";
    const mcpServerUrl = body.mcpServerUrl || "http://localhost:8002/mcp";

    console.log(`${tag} === Canvas MCP Run ===`);
    console.log(`${tag} prompt: ${userPrompt.slice(0, 120)}...`);
    console.log(`${tag} mcpServerUrl: ${mcpServerUrl}`);
    console.log(`${tag} DEDALUS_API_KEY set: ${!!process.env.DEDALUS_API_KEY}`);

    // Discover MCP tools
    let mcpToolWrappers: ReturnType<typeof createMcpToolWrappers> = [];
    let mcpToolNames: string[] = [];

    try {
      console.log(`${tag} Discovering MCP tools from ${mcpServerUrl}...`);
      const mcpTools = await discoverMcpTools(mcpServerUrl);
      mcpToolWrappers = createMcpToolWrappers(mcpServerUrl, mcpTools);
      mcpToolNames = mcpTools.map((t) => t.name);
      console.log(`${tag} MCP tools bridged: ${mcpToolNames.join(", ")}`);
    } catch (err: any) {
      console.error(`${tag} Failed to connect to MCP server at ${mcpServerUrl}: ${err.message}`);
      return NextResponse.json(
        {
          success: false,
          error: `Cannot connect to MCP server at ${mcpServerUrl}: ${err.message}`,
          hint: "Start the Canvas MCP server: cd server && uv run python server.py",
        },
        { status: 502 }
      );
    }

    const allTools = mcpToolWrappers.map((w) => w.fn);

    console.log(`${tag} All tools: ${mcpToolNames.join(", ")}`);

    const client = new Dedalus();
    const runner = new DedalusRunner(client);

    const toolList = mcpToolNames.map((n) => `${n} (MCP)`).join(", ");
    const instructions = [
      `You are a Canvas LMS student assistant.`,
      `You have these tools: ${toolList}.`,
      `Use list_courses to see the student's active courses.`,
      `Use list_assignments to get assignments for a specific course.`,
      `Use get_assignment to get details on a specific assignment.`,
      `Use get_my_submission to check submission status and grades.`,
      `Use get_upcoming_events to see upcoming deadlines.`,
      `Use get_todo_items to see what needs attention.`,
      `Use get_grades_summary to see grade breakdown for a course.`,
      `Use list_announcements to see recent course announcements.`,
      `Use list_modules to see course modules and content.`,
      `To find office hours and exam dates, use this strategy:`,
      `1. First try get_syllabus to get the syllabus body text for a course.`,
      `2. If the syllabus is empty or doesn't have what you need, use list_course_pages to find relevant wiki pages (search for "syllabus", "office hours", "exam", etc).`,
      `3. Use get_course_page to read the full content of a specific page.`,
      `4. Use search_course_files to find uploaded documents like syllabus PDFs.`,
      `When extracting office hours, look for patterns like days/times, TA names, professor names, locations, and Zoom links.`,
      `When extracting exam info, look for midterm/final dates, locations, and policies.`,
      `When showing results, format them clearly with course names, dates, and relevant details.`,
    ].join(" ");

    console.log(`${tag} Calling runner.run() with ${allTools.length} tools`);

    const startTime = Date.now();
    const result = await runner.run({
      input: userPrompt,
      model: "anthropic/claude-sonnet-4-20250514",
      instructions,
      tools: allTools as any,
      maxSteps: 15,
    });
    const elapsed = Date.now() - startTime;

    const r = result as any;
    console.log(`${tag} runner.run() completed in ${elapsed}ms`);
    console.log(`${tag} finalOutput: ${(r.finalOutput || "").slice(0, 200)}...`);

    return NextResponse.json({
      success: true,
      output: r.finalOutput,
      model: "anthropic/claude-sonnet-4-20250514",
      mcpServerUrl,
      mcpTools: mcpToolNames,
      _debug: {
        elapsed,
        toolsCalled: r.toolsCalled || r.tools_called || [],
        toolResults: r.toolResults || r.tool_results || [],
        resultKeys: Object.keys(r),
      },
    });
  } catch (error: any) {
    const errDetail: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(error)) {
      try { errDetail[key] = error[key]; } catch { /* skip */ }
    }

    console.error(`${tag} === ERROR ===`);
    console.error(`${tag} all props:`, JSON.stringify(errDetail, null, 2));
    console.error(`${tag} stack:`, error.stack);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        hint: "Make sure DEDALUS_API_KEY is set and the Canvas MCP server is running (cd server && uv run python server.py)",
        _debug: { name: error.name, message: error.message, status: error.status ?? error.statusCode },
      },
      { status: 500 }
    );
  }
}

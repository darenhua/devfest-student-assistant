import { NextResponse } from "next/server";
import Dedalus from "dedalus-labs";
import { DedalusRunner } from "dedalus-labs";

// ---------------------------------------------------------------------------
// MCP Bridge — same pattern as dedalus-mcp prototype.
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

  console.log(`[events-mcp-bridge] --> ${method} (id=${id})`);
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
  console.log(`[events-mcp-bridge] Initializing MCP session at ${url}`);

  await mcpJsonRpc(url, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "events-mcp-bridge", version: "0.1.0" },
  });

  try {
    await mcpJsonRpc(url, "notifications/initialized");
  } catch {
    // notifications may not return a response
  }

  const result = (await mcpJsonRpc(url, "tools/list")) as { tools: McpTool[] };
  console.log(`[events-mcp-bridge] Discovered ${result.tools.length} tools: ${result.tools.map((t) => t.name).join(", ")}`);
  return result.tools;
}

async function callMcpTool(url: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  console.log(`[events-mcp-bridge] Calling MCP tool: ${toolName}(${JSON.stringify(args)})`);
  const result = await mcpJsonRpc(url, "tools/call", { name: toolName, arguments: args });
  console.log(`[events-mcp-bridge] MCP tool ${toolName} result: ${JSON.stringify(result).slice(0, 200)}`);
  return result;
}

function extractMcpResult(result: any): string {
  if (result?.content) {
    const texts = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text);
    return texts.length === 1 ? texts[0] : texts.join("\n");
  }
  return JSON.stringify(result);
}

function createMcpToolWrappers(url: string, mcpTools: McpTool[]) {
  return mcpTools.map((tool) => {
    const schema = tool.inputSchema as any;
    const props = schema?.properties || {};
    const paramNames: string[] = Object.keys(props);

    console.log(`[events-mcp-bridge] Creating wrapper for ${tool.name}(${paramNames.join(", ")})`);

    const handler = async (argsObj: Record<string, unknown>) => {
      console.log(`[events-mcp-bridge] Wrapper ${tool.name} called with:`, JSON.stringify(argsObj));
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
// POST /prototypes/testin-events/run
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const tag = `[events-mcp ${Date.now()}]`;
  try {
    const body = await request.json();
    const userPrompt = body.prompt || "Fetch the latest Columbia events and show me what's happening this week.";
    const mcpServerUrl = body.mcpServerUrl || "http://localhost:8001/mcp";

    console.log(`${tag} === Events MCP Run ===`);
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
          hint: "Start the MCP server: cd server && uv run python server.py",
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
      `You are a Columbia University events assistant.`,
      `You have these tools: ${toolList}.`,
      `Use fetch_columbia_events to get fresh events from the university feed.`,
      `Use list_events to see what's already saved locally.`,
      `Use add_event, update_event, delete_event to manage the local event store.`,
      `When showing events, format them nicely with date, time, title, location, and description.`,
    ].join(" ");

    console.log(`${tag} Calling runner.run() with ${allTools.length} tools`);

    const startTime = Date.now();
    const result = await runner.run({
      input: userPrompt,
      model: "anthropic/claude-sonnet-4-20250514",
      instructions,
      tools: allTools as any,
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
        hint: "Make sure DEDALUS_API_KEY is set and the MCP server is running (cd server && uv run python server.py)",
        _debug: { name: error.name, message: error.message, status: error.status ?? error.statusCode },
      },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import Dedalus from "dedalus-labs";
import { DedalusRunner } from "dedalus-labs";

// ---------------------------------------------------------------------------
// Local tools — functions the LLM can call directly (no MCP server needed)
// ---------------------------------------------------------------------------

function greet(name: string): string {
  const n = typeof name === "object" ? (name as any).name : name;
  return `Hello, ${n}! This response came from a LOCAL tool (not MCP).`;
}

function formatAsBullets(items: string[]): string {
  const list = Array.isArray(items) ? items : (items as any).items;
  return list.map((item: string) => `• ${item}`).join("\n");
}

function getSchoolInfo(): Record<string, string> {
  return {
    school: "DevFest Academy",
    student: "Demo Student",
    grade: "10th",
    semester: "Spring 2026",
  };
}

// ---------------------------------------------------------------------------
// MCP Bridge — connect to local MCP server directly via JSON-RPC over HTTP,
// then expose its tools as local tools for the Dedalus runner.
//
// Why: The Dedalus cloud API can't reach localhost. So instead of passing
// mcpServers: ["http://localhost:8000/mcp"], we discover the MCP tools
// ourselves and proxy calls through local tool wrappers.
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

  console.log(`[mcp-bridge] --> ${method} (id=${id})`);
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

  // Handle SSE responses (some MCP servers use text/event-stream)
  if (contentType.includes("text/event-stream")) {
    const text = await res.text();
    console.log(`[mcp-bridge] <-- SSE response for ${method}`);
    // Parse SSE: find lines starting with "data: " and extract JSON
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

  // Handle regular JSON response
  const data = await res.json();
  console.log(`[mcp-bridge] <-- ${method} result keys: ${Object.keys(data)}`);
  if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function discoverMcpTools(url: string): Promise<McpTool[]> {
  console.log(`[mcp-bridge] Initializing MCP session at ${url}`);

  // Step 1: Initialize
  await mcpJsonRpc(url, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "dedalus-mcp-bridge", version: "0.1.0" },
  });

  // Step 2: Send initialized notification (no response expected, but some servers need it)
  try {
    await mcpJsonRpc(url, "notifications/initialized");
  } catch {
    // notifications may not return a response — that's fine
  }

  // Step 3: List tools
  const result = (await mcpJsonRpc(url, "tools/list")) as { tools: McpTool[] };
  console.log(`[mcp-bridge] Discovered ${result.tools.length} tools: ${result.tools.map((t) => t.name).join(", ")}`);
  return result.tools;
}

async function callMcpTool(url: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  console.log(`[mcp-bridge] Calling MCP tool: ${toolName}(${JSON.stringify(args)})`);
  const result = await mcpJsonRpc(url, "tools/call", { name: toolName, arguments: args });
  console.log(`[mcp-bridge] MCP tool ${toolName} result: ${JSON.stringify(result)}`);
  return result;
}

/**
 * Extract MCP tool result content as a string.
 */
function extractMcpResult(result: any): string {
  if (result?.content) {
    const texts = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text);
    return texts.length === 1 ? texts[0] : texts.join("\n");
  }
  return JSON.stringify(result);
}

/**
 * Create a wrapper function whose parameter names match the MCP tool's inputSchema.
 *
 * The Dedalus SDK parses Function.prototype.toString() to extract parameter names
 * and build the tool schema. So we use `new Function()` to dynamically generate
 * a function with the correct param names (e.g., `function hello(name)` instead
 * of `function hello(args)`).
 */
function createMcpToolWrappers(url: string, mcpTools: McpTool[]) {
  return mcpTools.map((tool) => {
    const schema = tool.inputSchema as any;
    const props = schema?.properties || {};
    const paramNames: string[] = Object.keys(props);

    console.log(`[mcp-bridge] Creating wrapper for ${tool.name}(${paramNames.join(", ")})`);

    // Handler that receives a proper { key: value } args object
    const handler = async (argsObj: Record<string, unknown>) => {
      console.log(`[mcp-bridge] Wrapper ${tool.name} called with:`, JSON.stringify(argsObj));
      const result = await callMcpTool(url, tool.name, argsObj);
      return extractMcpResult(result);
    };

    let fn: Function;

    if (paramNames.length === 0) {
      // No-arg tool (e.g., server_status)
      fn = async function () {
        return handler({});
      };
    } else {
      // Use `new Function` to create a function with the correct param names.
      // e.g., for hello(name): `async function hello(name) { return __handler({name}); }`
      //
      // The SDK will parse this and see the real param names.
      const argsList = paramNames.join(", ");
      const argsObjLiteral = paramNames.map((p) => `"${p}": ${p}`).join(", ");

      // new Function("__handler", "return async function hello(name) { return __handler({name}); }")
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
// POST /prototypes/dedalus-mcp/run
// Runs the Dedalus agent with local tools + MCP tools (bridged)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const tag = `[dedalus-mcp ${Date.now()}]`;
  try {
    const body = await request.json();
    const userPrompt = body.prompt || "Say hello to the user and tell them about the tools you have available.";
    const mcpServerUrl = body.mcpServerUrl || "http://localhost:8000/mcp";
    const skipMcp = body.skipMcp === true;

    console.log(`${tag} === Dedalus MCP Run ===`);
    console.log(`${tag} prompt: ${userPrompt.slice(0, 120)}...`);
    console.log(`${tag} mcpServerUrl: ${mcpServerUrl}`);
    console.log(`${tag} skipMcp: ${skipMcp}`);
    console.log(`${tag} DEDALUS_API_KEY set: ${!!process.env.DEDALUS_API_KEY}`);

    // Discover MCP tools from the local server (if enabled)
    let mcpToolWrappers: ReturnType<typeof createMcpToolWrappers> = [];
    let mcpToolNames: string[] = [];

    if (!skipMcp) {
      try {
        console.log(`${tag} Discovering MCP tools from ${mcpServerUrl}...`);
        const mcpTools = await discoverMcpTools(mcpServerUrl);
        mcpToolWrappers = createMcpToolWrappers(mcpServerUrl, mcpTools);
        mcpToolNames = mcpTools.map((t) => t.name);
        console.log(`${tag} MCP tools bridged as local tools: ${mcpToolNames.join(", ")}`);
      } catch (err: any) {
        console.error(`${tag} Failed to connect to MCP server at ${mcpServerUrl}: ${err.message}`);
        return NextResponse.json(
          {
            success: false,
            error: `Cannot connect to MCP server at ${mcpServerUrl}: ${err.message}`,
            hint: "Make sure the MCP server is running: cd server && uv run python server.py",
            _debug: { mcpConnectionError: err.message },
          },
          { status: 502 }
        );
      }
    }

    // Combine local tools + MCP tool wrappers
    const allTools = [
      greet,
      formatAsBullets,
      getSchoolInfo,
      ...mcpToolWrappers.map((w) => w.fn),
    ];
    const localToolNames = ["greet", "formatAsBullets", "getSchoolInfo"];

    console.log(`${tag} All tools: ${[...localToolNames, ...mcpToolNames].join(", ")}`);

    // The Dedalus client authenticates via DEDALUS_API_KEY env var
    const client = new Dedalus();
    const runner = new DedalusRunner(client);

    // Build instructions that tell the model about available tools
    const toolList = [
      ...localToolNames.map((n) => `${n} (local)`),
      ...mcpToolNames.map((n) => `${n} (MCP server)`),
    ].join(", ");
    const instructions = `You have these tools available: ${toolList}. Use them when asked.`;

    console.log(`${tag} Calling runner.run() with ${allTools.length} tools (no mcpServers — all bridged locally)`);

    const startTime = Date.now();
    const result = await runner.run({
      input: userPrompt,
      model: "anthropic/claude-sonnet-4-20250514",
      instructions,
      tools: allTools as any,
      // NO mcpServers — we bridge MCP tools as local tools instead
    });
    const elapsed = Date.now() - startTime;

    const r = result as any;
    console.log(`${tag} runner.run() completed in ${elapsed}ms`);
    console.log(`${tag} finalOutput: ${(r.finalOutput || "").slice(0, 200)}...`);
    console.log(`${tag} toolsCalled: ${JSON.stringify(r.toolsCalled || r.tools_called || [])}`);
    console.log(`${tag} full result keys: ${Object.keys(r)}`);

    return NextResponse.json({
      success: true,
      output: r.finalOutput,
      model: "anthropic/claude-sonnet-4-20250514",
      mcpServerUrl: skipMcp ? null : mcpServerUrl,
      localTools: localToolNames,
      mcpTools: mcpToolNames,
      _debug: {
        elapsed,
        toolsCalled: r.toolsCalled || r.tools_called || [],
        toolResults: r.toolResults || r.tool_results || [],
        mcpResults: r.mcpResults || r.mcp_results || [],
        resultKeys: Object.keys(r),
        bridgedMcpTools: mcpToolNames,
      },
    });
  } catch (error: any) {
    const errDetail: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(error)) {
      try { errDetail[key] = error[key]; } catch { /* skip */ }
    }
    const errorInfo = {
      name: error.name,
      message: error.message,
      status: error.status ?? error.statusCode ?? error.code,
      body: error.body ?? error.error ?? null,
      headers: error.headers ? Object.fromEntries(error.headers.entries?.() ?? []) : null,
      cause: error.cause?.message ?? null,
    };

    console.error(`${tag} === ERROR ===`);
    console.error(`${tag} all props:`, JSON.stringify(errDetail, null, 2));
    console.error(`${tag} parsed:`, JSON.stringify(errorInfo, null, 2));
    console.error(`${tag} stack:`, error.stack);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        hint: "Make sure DEDALUS_API_KEY is set and the MCP server is running (cd server && uv run python server.py)",
        _debug: errorInfo,
      },
      { status: 500 }
    );
  }
}

import Dedalus, { DedalusRunner } from "dedalus-labs";

// ---------------------------------------------------------------------------
// Dedalus client + runner (reused across requests)
// ---------------------------------------------------------------------------
const client = new Dedalus();
const runner = new DedalusRunner(client);

// ---------------------------------------------------------------------------
// Local tools — functions running in Node.js that the LLM can call
// ---------------------------------------------------------------------------

/** Get school and student metadata. */
function getSchoolInfo(): Record<string, string> {
  return {
    school: "DevFest Academy",
    student: "Demo Student",
    grade: "10th",
    semester: "Spring 2026",
  };
}

/** Format items as bullet points. */
function formatAsBullets(items: string[]): string {
  // SDK passes {items: [...]} for single-param functions
  const list = Array.isArray(items) ? items : (items as any).items ?? [];
  return list.map((item: string) => `• ${item}`).join("\n");
}

/** Get current date and time. */
function getCurrentTime(): string {
  return new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "America/Los_Angeles",
  });
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are School Assistant, a demo agent powered by Dedalus Labs.

You have tools from TWO sources:

LOCAL TOOLS (Node.js):
- getSchoolInfo: Returns school/student metadata
- formatAsBullets: Formats a list as bullet points
- getCurrentTime: Returns current date and time

MCP SERVER TOOLS (Python, via Dedalus MCP protocol):
- hello: Greet someone by name
- add: Add two numbers together
- server_status: Check the MCP server status
- whoami: Get authentication context

When you use a tool, briefly note whether it came from a local tool or the MCP server.
Be concise and helpful.`;

// ---------------------------------------------------------------------------
// POST /api/agent — streaming SSE
// ---------------------------------------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, mcpServerUrl = "http://localhost:8000/mcp" } = body;

    const streamResult = await runner.run({
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...messages,
      ],
      model: "anthropic/claude-sonnet-4-5-20250929",
      tools: [getSchoolInfo, formatAsBullets, getCurrentTime],
      mcpServers: [mcpServerUrl],
      maxSteps: 10,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (Symbol.asyncIterator in (streamResult as any)) {
            for await (const chunk of streamResult as any) {
              const delta = chunk.choices?.[0]?.delta;
              if (!delta) continue;

              if (delta.content) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text", content: delta.content })}\n\n`
                  )
                );
              }

              if (delta.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.function?.name) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "tool_call",
                          name: tc.function.name,
                          arguments: tc.function.arguments || "",
                        })}\n\n`
                      )
                    );
                  }
                }
              }
            }
          } else {
            // Non-streaming fallback
            const result = streamResult as any;
            const text = result.finalOutput || "";
            if (text) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text", content: text })}\n\n`
                )
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err: any) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", content: err.message })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}

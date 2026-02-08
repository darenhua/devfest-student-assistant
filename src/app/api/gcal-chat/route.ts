import Dedalus, { DedalusRunner, AuthenticationError } from "dedalus-labs";

const client = new Dedalus();
const runner = new DedalusRunner(client);

const GCAL_MCP_SLUG = "anny_personal/gcal-mcp";

function getCurrentTime(): string {
  return new Date().toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "America/Los_Angeles",
  });
}

const SYSTEM_PROMPT = `You are a Google Calendar assistant. You help the user view, create, update, and delete events on their Google Calendar using the available MCP tools.

Current date/time: ${getCurrentTime()}

Guidelines:
- When listing events, format them clearly with date, time, title, and any relevant details.
- When creating events, confirm the details before proceeding if anything is ambiguous.
- For time-relative queries ("tomorrow", "next week"), use the current date/time above.
- Be concise but thorough. Show event times in a readable format.
- If a tool call fails, explain what happened and suggest next steps.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    const streamResult = await runner.run({
      messages: [
        { role: "system" as const, content: SYSTEM_PROMPT },
        ...messages,
      ],
      model: "anthropic/claude-sonnet-4-5-20250929",
      tools: [getCurrentTime],
      mcpServers: [GCAL_MCP_SLUG],
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
    // Handle OAuth - AuthenticationError contains connect_url
    if (err instanceof AuthenticationError) {
      const errBody = err.error as any;
      const connectUrl =
        errBody?.connect_url ||
        errBody?.detail?.connect_url ||
        null;

      if (connectUrl) {
        return Response.json(
          { error: "oauth_required", connect_url: connectUrl },
          { status: 401 }
        );
      }
    }

    return Response.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}

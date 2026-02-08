import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, toolDefinitions } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    system: aiDocumentFormats.html.systemPrompt,
    messages: await convertToModelMessages(
      injectDocumentStateMessages(messages),
    ),
    tools: toolDefinitionsToToolSet(toolDefinitions),
    toolChoice: "required",
  });

  return result.toUIMessageStreamResponse();
}

import { NextResponse } from "next/server";
import Dedalus from "dedalus-labs";
import { DedalusRunner } from "dedalus-labs";

const client = new Dedalus();
const runner = new DedalusRunner(client);

const SYSTEM_INSTRUCTIONS = `You are a helpful school assistant for a college student. You answer questions about their schedule, assignments, deadlines, office hours, and exams.

You will receive the student's current daily briefing as context. Use it to answer their question accurately and concisely.

Rules:
- Be brief and direct (1-3 sentences)
- Reference specific dates, times, and locations from the briefing
- If the answer isn't in the briefing, say so honestly
- Never make up information that isn't in the context`;

export async function POST(request: Request) {
  try {
    const { question, context } = await request.json();

    if (!question?.trim()) {
      return NextResponse.json(
        { success: false, error: "No question provided" },
        { status: 400 }
      );
    }

    const input = context
      ? `Here is my current daily briefing:\n\n${context}\n\nMy question: ${question}`
      : question;

    const result = await runner.run({
      input,
      model: "anthropic/claude-sonnet-4-5-20250929",
      instructions: SYSTEM_INSTRUCTIONS,
      maxSteps: 2,
    });

    return NextResponse.json({
      success: true,
      answer: (result as any).finalOutput,
    });
  } catch (error: any) {
    console.error("BlockNote ask error:", error);
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

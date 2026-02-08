import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const BRIEFING_PATH = join(
  process.cwd(),
  "src/app/modules/final/data/briefing.md"
);

export async function GET() {
  try {
    const content = await readFile(BRIEFING_PATH, "utf-8");
    return Response.json({ markdown: content });
  } catch {
    return Response.json({ markdown: "" }, { status: 404 });
  }
}

export async function PUT(req: Request) {
  try {
    const { markdown } = await req.json();
    if (typeof markdown !== "string") {
      return Response.json({ error: "markdown must be a string" }, { status: 400 });
    }
    await writeFile(BRIEFING_PATH, markdown, "utf-8");
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

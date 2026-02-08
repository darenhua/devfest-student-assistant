import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const LINKS_FILE = join(
  process.cwd(),
  "src/app/prototypes/testin-ext-sources/server/LINKS.json"
);

async function readLinks(): Promise<any[]> {
  try {
    const raw = await readFile(LINKS_FILE, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeLinks(links: any[]): Promise<void> {
  await writeFile(LINKS_FILE, JSON.stringify(links, null, 2), "utf-8");
}

// GET — list all source links
export async function GET() {
  const links = await readLinks();
  return NextResponse.json(links);
}

// POST — add a new source link
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, label } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const links = await readLinks();

    // Check duplicate
    if (links.some((l: any) => l.url === url)) {
      return NextResponse.json({ error: "Source already exists" }, { status: 409 });
    }

    const parsed = new URL(url);
    const newLink = {
      id: parsed.hostname.replace(/\./g, "-") + "-" + Date.now(),
      url,
      label: label || parsed.pathname.replace(/^\/|\/$/g, "") || parsed.hostname,
      addedAt: new Date().toISOString(),
    };

    links.push(newLink);
    await writeLinks(links);

    return NextResponse.json(newLink, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// DELETE — remove a source link by id (passed as query param)
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id query param required" }, { status: 400 });
  }

  const links = await readLinks();
  const filtered = links.filter((l: any) => l.id !== id);

  if (filtered.length === links.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await writeLinks(filtered);
  return NextResponse.json({ deleted: id, remaining: filtered.length });
}

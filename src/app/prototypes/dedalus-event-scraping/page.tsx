"use client";

import { useState } from "react";

type AgentResult = {
  success: boolean;
  output?: string;
  error?: string;
  hint?: string;
  model?: string;
  localTools?: string[];
};

const EXAMPLE_PROMPTS = [
  {
    label: "Fetch Events",
    prompt:
      "Fetch upcoming Columbia University events for the next 14 days and give me a concise summary of what you found (count, date range, notable events).",
  },
  {
    label: "List Stored",
    prompt:
      "Read all events from the local JSON file and list them with their date, time, and title.",
  },
  {
    label: "Free Chat",
    prompt: "",
  },
];

export default function DedalusEventScrapingPage() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0].prompt);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAgent() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/prototypes/dedalus-event-scraping/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data: AgentResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Columbia Events Scraper</h1>
          <p className="text-gray-400 mt-1">
            Agent that fetches Columbia events, cleans them, and manages a local
            JSON store
          </p>
        </div>

        {/* Quick prompts */}
        <div className="flex gap-2 flex-wrap">
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex.label}
              onClick={() => setPrompt(ex.prompt)}
              className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-sm transition-colors border border-gray-700"
            >
              {ex.label}
            </button>
          ))}
        </div>

        {/* Prompt input */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-gray-900 border border-gray-700 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Ask the agent to fetch, list, add, update, or delete events..."
          />
        </div>

        {/* Run button */}
        <button
          onClick={runAgent}
          disabled={loading || !prompt.trim()}
          className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {loading ? "Running agent..." : "Run Agent"}
        </button>

        {/* Result */}
        {result && (
          <div
            className={`rounded-lg border p-4 space-y-3 ${
              result.success
                ? "bg-gray-900 border-gray-700"
                : "bg-red-950/50 border-red-800"
            }`}
          >
            {result.success ? (
              <>
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                  <span>Agent response</span>
                  {result.model && (
                    <span className="text-gray-500 font-normal">
                      via {result.model}
                    </span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">
                  {result.output}
                </pre>
                {result.localTools && (
                  <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
                    Tools: {result.localTools.join(", ")}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-red-400 text-sm font-medium">Error</div>
                <p className="text-sm text-red-300">{result.error}</p>
                {result.hint && (
                  <p className="text-xs text-gray-400">{result.hint}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* How it works */}
        <details className="rounded-lg border border-gray-800 bg-gray-900/50">
          <summary className="p-4 cursor-pointer text-sm font-medium text-gray-300 hover:text-gray-100">
            How this works
          </summary>
          <div className="px-4 pb-4 text-sm text-gray-400 space-y-3">
            <p>
              This prototype uses a Dedalus agent with local tools for event
              scraping:
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Agent Runner</strong> (
                <code>run/route.ts</code>) — Uses{" "}
                <code>DedalusRunner</code> with local tools that fetch from
                Columbia&apos;s Bedework API, clean the data, and manage a
                local <code>events.json</code> file.
              </li>
              <li>
                <strong>UI</strong> (<code>page.tsx</code>) — Sends
                prompts and displays agent responses.
              </li>
              <li>
                <strong>MCP Server</strong> (
                <code>server/server.py</code>) — Standalone Python MCP
                server with the same tools, for use with other MCP clients.
              </li>
            </ol>
            <p className="font-medium text-gray-300">Available tools:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <code>fetch_columbia_events</code> — Fetch, clean, and save
              </li>
              <li>
                <code>get_events</code> / <code>get_event</code> — Read from
                JSON
              </li>
              <li>
                <code>add_event</code> — Add a custom event
              </li>
              <li>
                <code>update_event</code> — Update event fields
              </li>
              <li>
                <code>delete_event</code> — Remove an event
              </li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
}

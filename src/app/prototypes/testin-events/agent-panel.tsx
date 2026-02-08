"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AgentResult = {
  success: boolean;
  output?: string;
  error?: string;
  hint?: string;
  model?: string;
  mcpServerUrl?: string | null;
  mcpTools?: string[];
  _debug?: Record<string, unknown>;
};

const EXAMPLE_PROMPTS = [
  {
    label: "Fetch Events",
    prompt:
      "Fetch the latest Columbia University events and show me a summary of what's happening in the next two weeks.",
  },
  {
    label: "List Saved",
    prompt:
      "List all events currently saved locally and show them formatted with date, time, title, and location.",
  },
  {
    label: "Fetch + Save",
    prompt:
      "Fetch fresh events from the Columbia feed and save them. Then list how many events are now stored.",
  },
  {
    label: "Add Manual",
    prompt:
      'Add a new event: "Study Group - Algorithms" on 2026-02-15 from 3pm to 5pm at Butler Library. Then list all events.',
  },
  {
    label: "Free Chat",
    prompt: "",
  },
];

export function AgentPanel() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0].prompt);
  const [mcpUrl, setMcpUrl] = useState("http://localhost:8001/mcp");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAgent() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/prototypes/testin-events/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mcpServerUrl: mcpUrl }),
      });
      const data: AgentResult = await res.json();
      setResult(data);
      // Refresh server component to re-read events.json
      router.refresh();
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Agent</h2>

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
          placeholder="Ask about Columbia events..."
        />
      </div>

      {/* MCP server URL */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          MCP Server URL
        </label>
        <input
          value={mcpUrl}
          onChange={(e) => setMcpUrl(e.target.value)}
          className="w-full rounded-lg bg-gray-900 border border-gray-700 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="http://localhost:8001/mcp"
        />
        <p className="text-xs text-gray-500">
          Start the server first:{" "}
          <code className="bg-gray-800 px-1 py-0.5 rounded">
            cd server && uv run python server.py
          </code>
        </p>
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
              <div className="flex flex-col gap-1 text-xs text-gray-500 pt-2 border-t border-gray-800">
                {result.mcpTools && result.mcpTools.length > 0 && (
                  <span>MCP tools: {result.mcpTools.join(", ")}</span>
                )}
                {result.mcpServerUrl && (
                  <span>MCP server: {result.mcpServerUrl}</span>
                )}
              </div>
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

          {result._debug && (
            <details className="mt-3 pt-3 border-t border-gray-800">
              <summary className="cursor-pointer text-xs font-medium text-yellow-500 hover:text-yellow-400">
                Debug info
              </summary>
              <pre className="mt-2 text-xs text-gray-400 bg-gray-950 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(result._debug, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

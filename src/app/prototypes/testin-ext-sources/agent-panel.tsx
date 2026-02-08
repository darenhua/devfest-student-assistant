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
    label: "Scan All",
    prompt:
      "Crawl all my source links and find any homework assignments, exams, office hours, and syllabus info. Save everything you find as structured findings.",
  },
  {
    label: "Homework",
    prompt:
      "Crawl all sources and find homework assignments and problem sets. Include due dates, submission details, and point values. Save as findings.",
  },
  {
    label: "Exams",
    prompt:
      "Crawl all sources and find exam dates — midterms, finals, quizzes. Include dates, locations, and what's covered. Save as findings.",
  },
  {
    label: "Office Hours",
    prompt:
      "Crawl all sources and find office hours for professors and TAs. Include days, times, locations, and Zoom links. Save as findings.",
  },
  {
    label: "Syllabus",
    prompt:
      "Crawl all sources and extract syllabus information: grading policies, course schedules, textbooks, and prerequisites. Save as findings.",
  },
  {
    label: "Show Findings",
    prompt: "List all saved findings, organized by type.",
  },
  {
    label: "Free Chat",
    prompt: "",
  },
];

export function AgentPanel() {
  const router = useRouter();
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0].prompt);
  const [mcpUrl, setMcpUrl] = useState("http://localhost:8003/mcp");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAgent() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/prototypes/testin-ext-sources/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mcpServerUrl: mcpUrl }),
      });
      const data: AgentResult = await res.json();
      setResult(data);
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
          placeholder="Ask about your course sources, assignments, exams..."
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
          placeholder="http://localhost:8003/mcp"
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

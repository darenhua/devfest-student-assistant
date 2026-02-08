"use client";

import { useState } from "react";

type DebugInfo = {
  elapsed?: number;
  toolsCalled?: string[];
  toolResults?: unknown[];
  mcpResults?: unknown[];
  resultKeys?: string[];
  name?: string;
  status?: number;
  body?: unknown;
};

type AgentResult = {
  success: boolean;
  output?: string;
  error?: string;
  hint?: string;
  model?: string;
  mcpServerUrl?: string | null;
  localTools?: string[];
  mcpTools?: string[];
  _debug?: DebugInfo;
};

const EXAMPLE_PROMPTS = [
  {
    label: "MCP Hello",
    prompt: "Call the hello tool (from the MCP server) with name 'World' and return the result.",
  },
  {
    label: "MCP Add",
    prompt: "Use the add tool from the MCP server to compute 42 + 58 and tell me the result.",
  },
  {
    label: "MCP Status",
    prompt: "Call the server_status tool from the MCP server and summarize the result.",
  },
  {
    label: "Local + MCP",
    prompt:
      "First call getSchoolInfo (local tool) to get school details. Then call the hello tool (MCP server) with the student's name. Return both results.",
  },
  {
    label: "School Info",
    prompt:
      "Call getSchoolInfo to get the school details, then call formatAsBullets with a list of 'key: value' strings for each field. Return the bulleted list.",
  },
  {
    label: "Free Chat",
    prompt: "",
  },
];

export default function DedalusMcpPage() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0].prompt);
  const [mcpUrl, setMcpUrl] = useState("http://localhost:8000/mcp");
  const [skipMcp, setSkipMcp] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAgent() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/prototypes/dedalus-mcp/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          ...(mcpUrl && { mcpServerUrl: mcpUrl }),
          skipMcp,
        }),
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
          <h1 className="text-2xl font-bold">Dedalus MCP Prototype</h1>
          <p className="text-gray-400 mt-1">
            Demo: LLM agent with local tools + Python MCP server via Dedalus SDK
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
            placeholder="Ask the agent something..."
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
            placeholder="http://localhost:8000/mcp"
          />
          <p className="text-xs text-gray-500">
            Start the Python MCP server first:{" "}
            <code className="bg-gray-800 px-1 py-0.5 rounded">cd server && uv run python server.py</code>
          </p>
          <label className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipMcp}
              onChange={(e) => setSkipMcp(e.target.checked)}
              className="rounded border-gray-600"
            />
            <span className="text-xs text-yellow-500">
              Skip MCP (local tools only — use this to test if the Dedalus API works without MCP)
            </span>
          </label>
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
                  <span>Local tools: {result.localTools?.join(", ")}</span>
                  {result.mcpTools && result.mcpTools.length > 0 && (
                    <span>MCP tools (bridged): {result.mcpTools.join(", ")}</span>
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

            {/* Debug panel */}
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

        {/* Architecture info */}
        <details className="rounded-lg border border-gray-800 bg-gray-900/50">
          <summary className="p-4 cursor-pointer text-sm font-medium text-gray-300 hover:text-gray-100">
            How this works
          </summary>
          <div className="px-4 pb-4 text-sm text-gray-400 space-y-3">
            <p>
              This prototype demonstrates the <strong>Dedalus Labs</strong> stack
              for building AI agents with MCP (Model Context Protocol):
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>MCP Server</strong> (<code>server/server.py</code>) — Built
                with <code>dedalus_mcp</code> Python package in its own uv
                venv. Defines tools via <code>@tool</code> decorator and
                configures DAuth for secure credential handling.
              </li>
              <li>
                <strong>Dedalus SDK Client</strong> (<code>run/route.ts</code>)
                — Uses <code>DedalusRunner</code> from the{" "}
                <code>dedalus-labs</code> npm package. Combines local TypeScript
                tools with remote MCP server tools in a single agent loop.
              </li>
              <li>
                <strong>UI</strong> (<code>page.tsx</code>) — Sends prompts to
                the API route and displays the agent&apos;s response.
              </li>
            </ol>
            <p>
              <strong>Auth flow:</strong> The SDK authenticates to Dedalus via{" "}
              <code>DEDALUS_API_KEY</code>. The MCP server uses DAuth with
              Connection schemas so user credentials are never exposed to your
              code.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

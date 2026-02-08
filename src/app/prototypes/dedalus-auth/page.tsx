"use client";

import { useState } from "react";

type AgentResult = {
  success: boolean;
  output?: string;
  error?: string;
  hint?: string;
  model?: string;
  mcpServer?: string;
  authenticated?: boolean;
  needsAuth?: boolean;
  connectUrl?: string;
};

type AuthState = "unknown" | "connecting" | "authenticated" | "failed";

const EXAMPLE_PROMPTS = [
  {
    label: "Who Am I?",
    prompt: "Call the whoami tool to check my identity and auth claims.",
  },
  {
    label: "Get Assignment",
    prompt:
      "Call whoami first, then call get_secret_assignment to see my homework.",
  },
  {
    label: "Submit Homework",
    prompt:
      "Call submit_homework with title 'DAuth Demo' and content 'Implemented OAuth 2.1 flow with Dedalus MCP'.",
  },
  {
    label: "Server Info",
    prompt: "Call server_info to see the auth configuration of this MCP server.",
  },
];

export default function DedalusAuthPage() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0].prompt);
  const [mcpUrl, setMcpUrl] = useState("http://localhost:8001/mcp");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("unknown");

  async function runAgent() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/prototypes/dedalus-auth/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mcpServerUrl: mcpUrl }),
      });
      const data: AgentResult = await res.json();
      setResult(data);

      if (data.needsAuth) {
        setAuthState("failed");
      } else if (data.success) {
        setAuthState("authenticated");
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleOAuthConnect() {
    if (!result?.connectUrl) return;
    setAuthState("connecting");
    // Open DAuth OAuth consent page in new tab
    window.open(result.connectUrl, "_blank", "noopener");
  }

  const authBadge = {
    unknown: { text: "Not tested", color: "bg-gray-700 text-gray-300" },
    connecting: { text: "Awaiting OAuth...", color: "bg-yellow-900 text-yellow-300" },
    authenticated: { text: "Authenticated", color: "bg-green-900 text-green-300" },
    failed: { text: "Auth required", color: "bg-red-900 text-red-300" },
  }[authState];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">DAuth Demo</h1>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${authBadge.color}`}
            >
              {authBadge.text}
            </span>
          </div>
          <p className="text-gray-400 mt-1">
            MCP server with Dedalus Auth (OAuth 2.1 + PKCE) — unauthenticated
            calls get 401 and trigger the consent flow.
          </p>
        </div>

        {/* Auth flow diagram */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-3">
            DAuth Flow
          </h2>
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <Step n={1} active={authState === "unknown"}>
              Call MCP tool
            </Step>
            <Arrow />
            <Step n={2} active={authState === "failed"}>
              401 + connect_url
            </Step>
            <Arrow />
            <Step n={3} active={authState === "connecting"}>
              OAuth consent
            </Step>
            <Arrow />
            <Step n={4} active={authState === "authenticated"}>
              Retry with token
            </Step>
          </div>
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
            placeholder="http://localhost:8001/mcp"
          />
          <p className="text-xs text-gray-500">
            Run{" "}
            <code className="bg-gray-800 px-1 py-0.5 rounded">
              cd server && uv run python server.py
            </code>{" "}
            to start the DAuth-enabled MCP server on port 8001.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={runAgent}
            disabled={loading || !prompt.trim()}
            className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? "Running agent..." : "Run Agent"}
          </button>

          {result?.needsAuth && result.connectUrl && (
            <button
              onClick={handleOAuthConnect}
              className="px-6 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors"
            >
              Connect via OAuth
            </button>
          )}
        </div>

        {/* Retry hint after OAuth */}
        {authState === "connecting" && (
          <div className="rounded-lg border border-yellow-800 bg-yellow-950/50 p-4 text-sm text-yellow-200">
            Complete the OAuth flow in the browser tab, then click{" "}
            <strong>Run Agent</strong> again to retry with your new token.
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className={`rounded-lg border p-4 space-y-3 ${
              result.success
                ? "bg-gray-900 border-green-800"
                : result.needsAuth
                  ? "bg-gray-900 border-amber-800"
                  : "bg-red-950/50 border-red-800"
            }`}
          >
            {result.success ? (
              <>
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                  <span>Authenticated response</span>
                  {result.model && (
                    <span className="text-gray-500 font-normal">
                      via {result.model}
                    </span>
                  )}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-gray-200 leading-relaxed">
                  {result.output}
                </pre>
                <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
                  MCP: {result.mcpServer}
                </div>
              </>
            ) : result.needsAuth ? (
              <>
                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                  <span>Authentication Required (401)</span>
                </div>
                <p className="text-sm text-amber-200">{result.error}</p>
                {result.connectUrl ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">
                      The MCP server returned a DAuth connect URL. Click
                      &quot;Connect via OAuth&quot; to authorize, then retry.
                    </p>
                    <code className="block text-xs bg-gray-800 p-2 rounded break-all text-gray-300">
                      {result.connectUrl}
                    </code>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">{result.hint}</p>
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

        {/* Architecture info */}
        <details className="rounded-lg border border-gray-800 bg-gray-900/50">
          <summary className="p-4 cursor-pointer text-sm font-medium text-gray-300 hover:text-gray-100">
            How DAuth works
          </summary>
          <div className="px-4 pb-4 text-sm text-gray-400 space-y-3">
            <p>
              <strong>DAuth</strong> is Dedalus Labs&apos; managed OAuth 2.1
              framework for MCP servers. Unlike the basic prototype, this server
              has <code>AuthorizationConfig(enabled=True)</code> — every request
              is validated.
            </p>
            <ol className="list-decimal list-inside space-y-2">
              <li>
                <strong>Server config</strong>: Uses{" "}
                <code>AuthorizationConfig</code> with{" "}
                <code>required_scopes=[&quot;read&quot;]</code> and the DAuth
                authorization server at{" "}
                <code>https://as.dedaluslabs.ai</code>.
              </li>
              <li>
                <strong>401 Challenge</strong>: Unauthenticated requests get a
                401 with a <code>WWW-Authenticate</code> header. The SDK
                discovers the authorization server via{" "}
                <code>/.well-known/oauth-protected-resource</code> (RFC 9728).
              </li>
              <li>
                <strong>AuthenticationError</strong>: The SDK raises an error
                containing a <code>connect_url</code> — the full OAuth
                authorization URL with PKCE challenge.
              </li>
              <li>
                <strong>Browser consent</strong>: The user visits the URL, logs
                in, and grants scopes. DAuth stores tokens server-side.
              </li>
              <li>
                <strong>Retry</strong>: On retry, the SDK includes the access
                token. The MCP server validates it and provides{" "}
                <code>auth_context</code> to tools (subject, scopes, claims).
              </li>
              <li>
                <strong>Per-tool scopes</strong>:{" "}
                <code>submit_homework</code> additionally requires the
                &quot;write&quot; scope via{" "}
                <code>required_scopes=[&quot;write&quot;]</code>.
              </li>
            </ol>
            <p>
              <strong>DPoP</strong>: DAuth uses Demonstrating
              Proof-of-Possession (RFC 9449) by default — tokens are
              cryptographically bound to the client&apos;s key, so stolen tokens
              are useless.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

// ---- Tiny sub-components for the flow diagram ----

function Step({
  n,
  active,
  children,
}: {
  n: number;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
        active
          ? "border-blue-500 bg-blue-950 text-blue-300"
          : "border-gray-700 bg-gray-800 text-gray-400"
      }`}
    >
      <span className="font-mono font-bold text-[10px]">{n}</span>
      {children}
    </span>
  );
}

function Arrow() {
  return <span className="text-gray-600">&#8594;</span>;
}

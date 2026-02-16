"use client";

import type { AgentConfig } from "./agents";
import type { AgentState } from "./useAgentRunner";

function AgentCard({
  agent,
  state,
  onRun,
}: {
  agent: AgentConfig;
  state: AgentState;
  onRun: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              state.status === "running"
                ? "animate-pulse bg-amber-400"
                : state.status === "done"
                  ? "bg-emerald-400"
                  : state.status === "error"
                    ? "bg-red-400"
                    : "bg-gray-300"
            }`}
          />
          <span className="text-sm font-medium text-gray-700">
            {agent.name}
          </span>
        </div>
        <button
          onClick={onRun}
          disabled={state.status === "running"}
          className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 disabled:opacity-40"
        >
          {state.status === "running" ? (
            <span className="flex items-center gap-1">
              <svg
                className="h-3 w-3 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Running
            </span>
          ) : (
            "Run \u25b6"
          )}
        </button>
      </div>

      {state.result && (
        <div className="mt-2 space-y-1">
          {state.result.output && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                <span className="ml-0.5">Response</span>
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs text-gray-600">
                {state.result.output}
              </pre>
            </details>
          )}

          {state.result._debug && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
                <span className="ml-0.5">Log</span>
              </summary>
              <div className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-500">
                {state.result._debug.toolsCalled &&
                  state.result._debug.toolsCalled.length > 0 && (
                    <p>
                      Tools: {state.result._debug.toolsCalled.join(", ")}
                    </p>
                  )}
                {state.result.mcpTools &&
                  state.result.mcpTools.length > 0 && (
                    <p>MCP: {state.result.mcpTools.join(", ")}</p>
                  )}
                {state.result._debug.elapsed != null && (
                  <p>
                    Elapsed: {(state.result._debug.elapsed / 1000).toFixed(1)}s
                  </p>
                )}
              </div>
            </details>
          )}

          {state.result.error && (
            <div className="rounded bg-red-50 p-2 text-xs text-red-600">
              {state.result.error}
              {state.result.hint && (
                <p className="mt-1 text-red-400">{state.result.hint}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentView({
  agents,
  agentStates,
  runAgent,
}: {
  agents: AgentConfig[];
  agentStates: Record<string, AgentState>;
  runAgent: (agent: AgentConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
        Agents
      </p>
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          state={agentStates[agent.id] || { status: "idle", result: null }}
          onRun={() => runAgent(agent)}
        />
      ))}
    </div>
  );
}

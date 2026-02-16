"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AGENTS_BY_TAB, type AgentConfig } from "./agents";
import type { AgentRunResult } from "./types";

export interface AgentState {
  status: "idle" | "running" | "done" | "error";
  result: AgentRunResult | null;
}

// Collect every unique agent across all tabs
const ALL_AGENTS: AgentConfig[] = [];
const seen = new Set<string>();
for (const agents of Object.values(AGENTS_BY_TAB)) {
  for (const a of agents) {
    if (!seen.has(a.id)) {
      seen.add(a.id);
      ALL_AGENTS.push(a);
    }
  }
}

const AUTO_RUN_INTERVAL = 30_000;

export function useAgentRunner(onDataRefresh: () => void) {
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>(
    () =>
      Object.fromEntries(
        ALL_AGENTS.map((a) => [a.id, { status: "idle" as const, result: null }]),
      ),
  );
  const [autoMode, setAutoMode] = useState(false);

  const statesRef = useRef(agentStates);
  statesRef.current = agentStates;

  const runAgent = useCallback(
    async (agent: AgentConfig) => {
      if (statesRef.current[agent.id]?.status === "running") return;

      setAgentStates((prev) => ({
        ...prev,
        [agent.id]: { status: "running", result: null },
      }));

      try {
        const body: Record<string, string> = { prompt: agent.prompt };
        if (agent.mcpServerUrl) body.mcpServerUrl = agent.mcpServerUrl;

        const res = await fetch(agent.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data: AgentRunResult = await res.json();

        setAgentStates((prev) => ({
          ...prev,
          [agent.id]: {
            status: data.success ? "done" : "error",
            result: data,
          },
        }));

        if (data.success) onDataRefresh();
      } catch (err: any) {
        setAgentStates((prev) => ({
          ...prev,
          [agent.id]: {
            status: "error",
            result: { success: false, error: err.message || "Network error" },
          },
        }));
      }
    },
    [onDataRefresh],
  );

  const runAgentRef = useRef(runAgent);
  runAgentRef.current = runAgent;

  // Auto-run: when enabled, fire idle agents immediately then every 30s
  useEffect(() => {
    if (!autoMode) return;

    // Run idle agents right away on toggle-on
    for (const agent of ALL_AGENTS) {
      if (statesRef.current[agent.id]?.status === "idle") {
        runAgentRef.current(agent);
      }
    }

    const id = setInterval(() => {
      for (const agent of ALL_AGENTS) {
        if (statesRef.current[agent.id]?.status === "idle") {
          runAgentRef.current(agent);
        }
      }
    }, AUTO_RUN_INTERVAL);
    return () => clearInterval(id);
  }, [autoMode]);

  // Derived: which tabs have at least one agent running?
  const runningTabs = new Set<string>();
  for (const [tabKey, agents] of Object.entries(AGENTS_BY_TAB)) {
    if (agents.some((a) => agentStates[a.id]?.status === "running")) {
      runningTabs.add(tabKey);
    }
  }

  return { agentStates, runAgent, runningTabs, autoMode, setAutoMode };
}

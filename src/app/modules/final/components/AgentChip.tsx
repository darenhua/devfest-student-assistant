import type { Agent } from "./types";

export function AgentChip({ agent }: { agent: Agent }) {
  const isWorking = agent.status === "working";

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isWorking ? "bg-green-500" : "bg-gray-300"
        }`}
      />
      <span className="text-xs text-gray-500">{agent.name}</span>
    </div>
  );
}

import { getEvents } from "./actions";
import type { CleanEvent } from "./types";
import { AgentPanel } from "./agent-panel";

export default async function TestinEventsPage() {
  const events = await getEvents();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-[family-name:var(--font-geist-sans)]">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Columbia Events Agent</h1>
          <p className="text-gray-400 mt-1">
            MCP-powered agent that fetches, cleans, and manages Columbia
            University events
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Agent panel */}
          <AgentPanel />

          {/* Right: Events from local JSON */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Stored Events
              </h2>
              <span className="text-xs text-gray-500">
                {events.length} event{events.length !== 1 && "s"} in events.json
              </span>
            </div>

            {events.length === 0 ? (
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 text-center text-sm text-gray-500">
                No events yet. Use the agent to fetch Columbia events.
              </div>
            ) : (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {events.map((event: CleanEvent) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-sm leading-tight">
                        {event.summary}
                      </h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap shrink-0">
                        {event.calendar.shortLabel}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>{event.calendar.timeRange}</p>
                      {event.location.address && (
                        <p className="text-gray-500">{event.location.address}</p>
                      )}
                      {event.description && (
                        <p className="text-gray-600 line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </div>
                    {event._source === "manual" && (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-400 border border-blue-800">
                        manual
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

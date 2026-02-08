"use client";

import { CalendarEvent as CalendarEventType } from "./types";

interface CalendarEventProps {
  event: CalendarEventType;
}

export default function CalendarEvent({ event }: CalendarEventProps) {
  const startTime = new Date(event.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className="flex items-center gap-2 rounded px-2 py-1 text-xs truncate"
      style={{ backgroundColor: event.color + "20", borderLeft: `3px solid ${event.color}` }}
    >
      <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
        {startTime} {event.title}
      </span>
    </div>
  );
}

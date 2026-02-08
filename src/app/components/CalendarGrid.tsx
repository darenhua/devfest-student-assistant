"use client";

import { CalendarEvent as CalendarEventType } from "./types";
import CalendarEvent from "./CalendarEvent";

interface CalendarGridProps {
  weekStart: Date;
  events: CalendarEventType[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarGrid({ weekStart, events }: CalendarGridProps) {
  const today = new Date();

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  function eventsForDay(day: Date): CalendarEventType[] {
    return events
      .filter((e) => isSameDay(new Date(e.start), day))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  return (
    <div className="grid grid-cols-7 gap-px rounded-lg bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
      {days.map((day, i) => {
        const isToday = isSameDay(day, today);
        const dayEvents = eventsForDay(day);
        const dateLabel = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });

        return (
          <div
            key={i}
            className={`flex min-h-[400px] flex-col bg-white p-2 dark:bg-zinc-900 ${
              isToday ? "ring-2 ring-inset ring-blue-500" : ""
            }`}
          >
            <div className="mb-2 flex flex-col items-center gap-0.5">
              <span className="text-[10px] font-medium uppercase text-zinc-400 dark:text-zinc-500">
                {DAY_LABELS[i]}
              </span>
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                  isToday
                    ? "bg-blue-600 font-bold text-white"
                    : "text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {day.getDate()}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{dateLabel.split(" ")[0]}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              {dayEvents.map((evt) => (
                <CalendarEvent key={evt.id} event={evt} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

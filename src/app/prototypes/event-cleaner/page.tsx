import rawData from "./data.json";
import type { BedeworkEvent, BedeworkEventList, CleanEvent } from "./types";

function cleanEvent(raw: BedeworkEvent): CleanEvent {
  const dayName = raw.start.dayname.slice(0, 3); // "Mon"
  const shortDate = raw.start.shortdate; // "2/9/26"
  const datePart = shortDate.replace(/\/\d{2}$/, ""); // "2/9"
  const allDay = raw.start.allday === "true";
  const timeRange = allDay
    ? "All day"
    : `${raw.start.time} - ${raw.end.time}`;

  return {
    summary: raw.summary.replace(/&amp;/g, "&").replace(/&#39;/g, "'"),
    link: raw.link,
    eventlink: raw.eventlink,
    startDate: raw.startDate,
    endDate: raw.endDate,
    location: {
      address: raw.location.address.replace(/\t/g, " "),
      mapLink: raw.location.link,
    },
    description: raw.description
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim(),
    calendar: {
      shortLabel: `${dayName} ${datePart}`,
      timeRange,
      timezone: raw.start.timezone,
      allDay,
    },
  };
}

export default function EventCleanerPage() {
  const data = rawData as unknown as BedeworkEventList;
  const rawEvents = data.bwEventList.events;
  const cleanEvents = rawEvents.map(cleanEvent);

  const rawSize = JSON.stringify(rawEvents).length;
  const cleanSize = JSON.stringify(cleanEvents).length;
  const reduction = Math.round((1 - cleanSize / rawSize) * 100);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-mono">
      <h1 className="text-2xl font-bold mb-2">Event Cleaner Prototype</h1>
      <p className="text-zinc-400 mb-6">
        {rawEvents.length} events &middot; {rawSize.toLocaleString()} chars raw
        &rarr; {cleanSize.toLocaleString()} chars clean ({reduction}% smaller)
      </p>

      <div className="grid grid-cols-2 gap-6">
        {/* Before */}
        <div>
          <h2 className="text-lg font-semibold text-red-400 mb-3">
            Raw (before)
          </h2>
          {rawEvents.map((event, i) => (
            <details
              key={i}
              className="mb-3 bg-zinc-900 rounded-lg border border-zinc-800"
            >
              <summary className="p-3 cursor-pointer hover:bg-zinc-800 rounded-lg text-sm">
                {event.summary}
              </summary>
              <pre className="p-3 text-xs text-zinc-400 overflow-x-auto max-h-96">
                {JSON.stringify(event, null, 2)}
              </pre>
            </details>
          ))}
        </div>

        {/* After */}
        <div>
          <h2 className="text-lg font-semibold text-green-400 mb-3">
            Clean (after)
          </h2>
          {cleanEvents.map((event, i) => (
            <div
              key={i}
              className="mb-3 bg-zinc-900 rounded-lg border border-zinc-800 p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-sm">{event.summary}</h3>
                <span className="text-xs text-zinc-500 whitespace-nowrap ml-2">
                  {event.calendar.shortLabel}
                </span>
              </div>
              <div className="text-xs text-zinc-400 space-y-1">
                <p>{event.calendar.timeRange}</p>
                <p>{event.location.address}</p>
                <p className="text-zinc-500 line-clamp-2">
                  {event.description}
                </p>
              </div>
              <details className="mt-2">
                <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400">
                  JSON
                </summary>
                <pre className="text-xs text-zinc-500 mt-1 overflow-x-auto">
                  {JSON.stringify(event, null, 2)}
                </pre>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

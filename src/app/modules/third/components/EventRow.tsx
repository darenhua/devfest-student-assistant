import { DraggableItem } from "./DraggableItem";
import type { EventItem } from "./types";

export function EventRow({ event }: { event: EventItem }) {
  const content = (
    <>
      <p className="text-sm text-[#171717]">{event.title}</p>
      <p className="text-[11px] text-gray-400">
        {event.timeLabel}
        {event.location && <> &middot; {event.location}</>}
      </p>
    </>
  );
  return (
    <DraggableItem
      id={`event-${event.id}`}
      data={{ type: "event", item: event }}
    >
      {event.sourceUrl ? (
        <a
          href={event.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="-mx-2 block px-2 py-2 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
        >
          {content}
        </a>
      ) : (
        <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
          {content}
        </div>
      )}
    </DraggableItem>
  );
}

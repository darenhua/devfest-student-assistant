"use client";

import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { Sentinel } from "./Sentinel";
import { HomeworkRow } from "./HomeworkRow";
import { EventRow } from "./EventRow";
import { OfficeHourRow } from "./OfficeHourRow";
import { ExamRow } from "./ExamRow";
import type { AnyItem } from "./types";

interface AllListProps {
  allItems: AnyItem[];
}

export function AllList({ allItems }: AllListProps) {
  const { items, hasMore, sentinelRef } = useInfiniteScroll(allItems);

  return (
    <div className="group/list px-5 py-4">
      {items.map((entry) => {
        switch (entry.kind) {
          case "homework":
            return (
              <HomeworkRow key={`hw-${entry.item.id}`} hw={entry.item} />
            );
          case "event":
            return (
              <EventRow key={`ev-${entry.item.id}`} event={entry.item} />
            );
          case "office_hour":
            return (
              <OfficeHourRow key={`oh-${entry.item.id}`} oh={entry.item} />
            );
          case "exam":
            return (
              <ExamRow key={`ex-${entry.item.id}`} exam={entry.item} />
            );
        }
      })}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

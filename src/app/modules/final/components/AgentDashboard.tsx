"use client";

import { useState, useCallback, useRef } from "react";
import { AssignmentCard } from "./AssignmentCard";
import { DraggableItem } from "./DraggableItem";
import { ASSIGNMENTS, EVENTS, OFFICE_HOURS, EXAMS } from "./fixtures";
import type { Assignment, SchoolEvent, OfficeHour, Exam } from "./types";

const PAGE_SIZE = 20;

function useInfiniteScroll<T>(allItems: T[]) {
  const [count, setCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setCount((prev) => Math.min(prev + PAGE_SIZE, allItems.length));
          }
        },
        { threshold: 0.1 },
      );
      observerRef.current.observe(node);
    },
    [allItems.length],
  );

  const items = allItems.slice(0, count);
  const hasMore = count < allItems.length;

  return { items, hasMore, sentinelRef };
}


function EventRow({ event }: { event: SchoolEvent }) {
  return (
    <DraggableItem id={`event-${event.id}`} data={{ type: "event", item: event }}>
      <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
        <p className="text-sm text-[#171717]">{event.title}</p>
        <p className="text-[11px] text-gray-400">
          {event.time} &middot; {event.location}
        </p>
      </div>
    </DraggableItem>
  );
}

function OfficeHourRow({ oh }: { oh: OfficeHour }) {
  return (
    <DraggableItem id={`oh-${oh.id}`} data={{ type: "office_hour", item: oh }}>
      <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
        <p className="text-sm text-[#171717]">{oh.professor}</p>
        <p className="text-[11px] text-gray-400">
          {oh.course} &middot; {oh.day} {oh.startTime}&ndash;{oh.endTime}
        </p>
      </div>
    </DraggableItem>
  );
}

function ExamRow({ exam }: { exam: Exam }) {
  return (
    <DraggableItem id={`exam-${exam.id}`} data={{ type: "exam", item: exam }}>
      <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
        <p className="text-sm text-[#171717]">{exam.title}</p>
        <p className="text-[11px] text-gray-400">
          {exam.course} &middot; {exam.date} &middot; {exam.time}
        </p>
      </div>
    </DraggableItem>
  );
}

function AssignmentRow({ assignment }: { assignment: Assignment }) {
  return (
    <DraggableItem
      id={`assignment-${assignment.id}`}
      data={{ type: "assignment", item: assignment }}
    >
      <AssignmentCard assignment={assignment} />
    </DraggableItem>
  );
}

function Sentinel({ hasMore, sentinelRef }: { hasMore: boolean; sentinelRef: (node: HTMLDivElement | null) => void }) {
  if (!hasMore) return null;
  return <div ref={sentinelRef} className="h-8" />;
}

/* ─── Individual tab lists ─── */

function HomeworkList() {
  const { items, hasMore, sentinelRef } = useInfiniteScroll(ASSIGNMENTS);
  return (
    <div className="group/list px-5 py-4">
      {items.map((a) => (
        <AssignmentRow key={a.id} assignment={a} />
      ))}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

function EventsList() {
  const { items, hasMore, sentinelRef } = useInfiniteScroll(EVENTS);
  return (
    <div className="group/list px-5 py-4">
      {items.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

function OfficeHoursList() {
  const { items, hasMore, sentinelRef } = useInfiniteScroll(OFFICE_HOURS);
  return (
    <div className="group/list px-5 py-4">
      {items.map((oh) => (
        <OfficeHourRow key={oh.id} oh={oh} />
      ))}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

function ExamsList() {
  const { items, hasMore, sentinelRef } = useInfiniteScroll(EXAMS);
  return (
    <div className="group/list px-5 py-4">
      {items.map((exam) => (
        <ExamRow key={exam.id} exam={exam} />
      ))}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

function AllList() {
  // Merge everything into one contiguous list — no borders between sections
  const allItems = [
    ...ASSIGNMENTS.map((a) => ({ kind: "assignment" as const, item: a })),
    ...EVENTS.map((e) => ({ kind: "event" as const, item: e })),
    ...OFFICE_HOURS.map((oh) => ({ kind: "office_hour" as const, item: oh })),
    ...EXAMS.map((ex) => ({ kind: "exam" as const, item: ex })),
  ];
  const { items, hasMore, sentinelRef } = useInfiniteScroll(allItems);

  return (
    <div className="group/list px-5 py-4">
      {items.map((entry) => {
        switch (entry.kind) {
          case "assignment":
            return <AssignmentRow key={`a-${entry.item.id}`} assignment={entry.item} />;
          case "event":
            return <EventRow key={`e-${entry.item.id}`} event={entry.item as SchoolEvent} />;
          case "office_hour":
            return <OfficeHourRow key={`oh-${entry.item.id}`} oh={entry.item as OfficeHour} />;
          case "exam":
            return <ExamRow key={`ex-${entry.item.id}`} exam={entry.item as Exam} />;
        }
      })}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

/* ─── Tabs ─── */

const TABS = [
  { key: "all", label: "All" },
  { key: "homework", label: "Homework" },
  { key: "office_hours", label: "Office Hours" },
  { key: "events", label: "Events" },
  { key: "exams", label: "Exams" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ─── Main dashboard ─── */

export function AgentDashboard() {
  const [tab, setTab] = useState<TabKey>("all");

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-gray-100/70 p-1 mx-5 mt-3">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-md px-3 py-1.5 text-[13px] transition-all ${
              tab === t.key
                ? "bg-white text-gray-900 font-medium shadow-sm"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "all" && <AllList />}
        {tab === "homework" && <HomeworkList />}
        {tab === "office_hours" && <OfficeHoursList />}
        {tab === "events" && <EventsList />}
        {tab === "exams" && <ExamsList />}
      </div>

      {tab !== "all" && (
        <>
          <div className="h-px shrink-0 bg-muted-foreground/30" />

          <div className="h-[300px] shrink-0 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">Agent View</p>
          </div>
        </>
      )}
    </div>
  );
}

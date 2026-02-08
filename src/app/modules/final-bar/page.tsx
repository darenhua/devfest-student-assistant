"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  getEventItems,
  getHomeworkItems,
  getOfficeHourItems,
  getExamItems,
} from "./actions";
import { AGENTS_BY_TAB } from "./agents";
import AgentView from "./components/AgentView";
import { useAgentRunner } from "./useAgentRunner";
import type {
  EventItem,
  HomeworkItem,
  OfficeHourItem,
  ExamItem,
  AnyItem,
} from "./types";

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

/* ─── Row components ─── */

function EventRow({ event }: { event: EventItem }) {
  const inner = (
    <>
      <p className="text-sm text-[#171717]">{event.title}</p>
      <p className="text-[11px] text-gray-400">
        {event.timeLabel}
        {event.location && <> &middot; {event.location}</>}
      </p>
    </>
  );
  if (event.sourceUrl) {
    return (
      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="-mx-2 block px-2 py-2 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
      {inner}
    </div>
  );
}

function HomeworkRow({ hw }: { hw: HomeworkItem }) {
  return (
    <a
      href={hw.sourceUrl || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="-mx-2 flex items-center justify-between px-2 py-2.5 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#171717]">
          {hw.title}
        </p>
        <p className="text-[11px] text-gray-400">
          {hw.className && <>{hw.className} &middot; </>}
          {hw.dueDate}
        </p>
      </div>
      <span className="ml-3 shrink-0 text-[11px] text-gray-400">
        {hw.sourceName} &uarr;
      </span>
    </a>
  );
}

function OfficeHourRow({ oh }: { oh: OfficeHourItem }) {
  const inner = (
    <>
      <p className="text-sm text-[#171717]">{oh.label}</p>
      <p className="text-[11px] text-gray-400">
        {oh.timeInfo}
        {oh.location && <> &middot; {oh.location}</>}
      </p>
    </>
  );
  if (oh.sourceUrl) {
    return (
      <a
        href={oh.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="-mx-2 block px-2 py-2 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
      {inner}
    </div>
  );
}

function ExamRow({ exam }: { exam: ExamItem }) {
  const inner = (
    <>
      <p className="text-sm text-[#171717]">{exam.title}</p>
      <p className="text-[11px] text-gray-400">
        {exam.timeInfo}
        {exam.location && <> &middot; {exam.location}</>}
      </p>
    </>
  );
  if (exam.sourceUrl) {
    return (
      <a
        href={exam.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="-mx-2 block px-2 py-2 transition duration-1000 pointer-fine:group-has-[a:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0"
      >
        {inner}
      </a>
    );
  }
  return (
    <div className="-mx-2 px-2 py-2 transition duration-1000 pointer-fine:group-has-[div:hover]/list:opacity-40 hover:!opacity-100 hover:bg-gray-50 hover:duration-0">
      {inner}
    </div>
  );
}

function Sentinel({
  hasMore,
  sentinelRef,
}: {
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
}) {
  if (!hasMore) return null;
  return <div ref={sentinelRef} className="h-8" />;
}

/* ─── Tab lists ─── */

function HomeworkList({ items }: { items: HomeworkItem[] }) {
  const { items: visible, hasMore, sentinelRef } = useInfiniteScroll(items);
  return (
    <div className="group/list px-5 py-4">
      {visible.map((hw) => (
        <HomeworkRow key={hw.id} hw={hw} />
      ))}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

function EventsList({ items }: { items: EventItem[] }) {
  const { items: visible, hasMore, sentinelRef } = useInfiniteScroll(items);
  return (
    <div className="group/list px-5 py-4">
      {visible.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

function OfficeHoursList({ items }: { items: OfficeHourItem[] }) {
  const { items: visible, hasMore, sentinelRef } = useInfiniteScroll(items);
  return (
    <div className="group/list px-5 py-4">
      {visible.map((oh) => (
        <OfficeHourRow key={oh.id} oh={oh} />
      ))}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

function ExamsList({ items }: { items: ExamItem[] }) {
  const { items: visible, hasMore, sentinelRef } = useInfiniteScroll(items);
  return (
    <div className="group/list px-5 py-4">
      {visible.map((exam) => (
        <ExamRow key={exam.id} exam={exam} />
      ))}
      <Sentinel hasMore={hasMore} sentinelRef={sentinelRef} />
    </div>
  );
}

function AllList({ allItems }: { allItems: AnyItem[] }) {
  const { items, hasMore, sentinelRef } = useInfiniteScroll(allItems);
  return (
    <div className="group/list px-5 py-4">
      {items.map((entry) => {
        switch (entry.kind) {
          case "homework":
            return <HomeworkRow key={`hw-${entry.item.id}`} hw={entry.item} />;
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

/* ─── Tabs ─── */

const TABS = [
  { key: "all", label: "All" },
  { key: "homework", label: "Homework" },
  { key: "office_hours", label: "Office Hours" },
  { key: "events", label: "Events" },
  { key: "exams", label: "Exams" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ─── Page ─── */

export default function FinalBarPage() {
  const [tab, setTab] = useState<TabKey>("all");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [officeHours, setOfficeHours] = useState<OfficeHourItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [e, h, oh, ex] = await Promise.all([
      getEventItems(),
      getHomeworkItems(),
      getOfficeHourItems(),
      getExamItems(),
    ]);
    setEvents(e);
    setHomework(h);
    setOfficeHours(oh);
    setExams(ex);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { agentStates, runAgent, runningTabs } = useAgentRunner(loadData);

  const allItems: AnyItem[] = [
    ...homework.map((item) => ({ kind: "homework" as const, item })),
    ...events.map((item) => ({ kind: "event" as const, item })),
    ...officeHours.map((item) => ({ kind: "office_hour" as const, item })),
    ...exams.map((item) => ({ kind: "exam" as const, item })),
  ];

  return (
    <div className="flex h-screen flex-col overflow-y-auto bg-gray-50/50">
      <div className="mx-5 mt-3 flex shrink-0 items-center gap-0.5 overflow-visible rounded-lg bg-gray-100/70 p-1">
        {TABS.map((t) => {
          const isRunning = t.key !== "all" && runningTabs.has(t.key);
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative rounded-md px-3 py-1.5 text-[13px] transition-all ${
                tab === t.key
                  ? "bg-white font-medium text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              } ${isRunning ? "z-10" : ""}`}
            >
              {t.label}
              {isRunning && (
                <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "all" && <AllList allItems={allItems} />}
            {tab === "homework" && <HomeworkList items={homework} />}
            {tab === "office_hours" && <OfficeHoursList items={officeHours} />}
            {tab === "events" && <EventsList items={events} />}
            {tab === "exams" && <ExamsList items={exams} />}
          </div>

          {tab !== "all" && (
            <>
              <div className="h-px shrink-0 bg-gray-200" />
              <div className="shrink-0 overflow-y-auto">
                <AgentView
                  agents={AGENTS_BY_TAB[tab] || []}
                  agentStates={agentStates}
                  runAgent={runAgent}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

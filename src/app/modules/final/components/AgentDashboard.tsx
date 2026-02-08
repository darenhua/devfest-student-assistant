"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AssignmentCard } from "./AssignmentCard";
import { DraggableItem } from "./DraggableItem";
import { AgentView } from "./AgentView";
import { AGENTS_BY_TAB } from "./agents";
import { useAgentRunner } from "./useAgentRunner";
import {
  getEventItems,
  getHomeworkItems,
  getOfficeHourItems,
  getExamItems,
  addSource,
  getSources,
  type SourceEntry,
} from "../actions";
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

/* ─── Row components (with drag support) ─── */

function EventRow({ event }: { event: EventItem }) {
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

function OfficeHourRow({ oh }: { oh: OfficeHourItem }) {
  const content = (
    <>
      <p className="text-sm text-[#171717]">{oh.label}</p>
      <p className="text-[11px] text-gray-400">
        {oh.timeInfo}
        {oh.location && <> &middot; {oh.location}</>}
      </p>
    </>
  );
  return (
    <DraggableItem
      id={`oh-${oh.id}`}
      data={{ type: "office_hour", item: oh }}
    >
      {oh.sourceUrl ? (
        <a
          href={oh.sourceUrl}
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

function ExamRow({ exam }: { exam: ExamItem }) {
  const content = (
    <>
      <p className="text-sm text-[#171717]">{exam.title}</p>
      <p className="text-[11px] text-gray-400">
        {exam.timeInfo}
        {exam.location && <> &middot; {exam.location}</>}
      </p>
    </>
  );
  return (
    <DraggableItem
      id={`exam-${exam.id}`}
      data={{ type: "exam", item: exam }}
    >
      {exam.sourceUrl ? (
        <a
          href={exam.sourceUrl}
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

function HomeworkRow({ hw }: { hw: HomeworkItem }) {
  return (
    <DraggableItem
      id={`hw-${hw.id}`}
      data={{ type: "homework", item: hw }}
    >
      <AssignmentCard hw={hw} />
    </DraggableItem>
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

/* ─── Add Source Modal ─── */

function AddSourceModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<SourceEntry[]>([]);

  useEffect(() => {
    getSources().then(setSources);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setSaving(true);
    try {
      await addSource(url.trim(), label.trim() || new URL(url.trim()).hostname);
      setUrl("");
      setLabel("");
      setSaving(false);
      getSources().then(setSources);
    } catch {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-96 rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
        <p className="mb-3 text-sm font-medium text-gray-900">Sources</p>

        {sources.length > 0 && (
          <ul className="mb-4 max-h-48 space-y-1.5 overflow-y-auto">
            {sources.map((s) => (
              <li key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-gray-100 px-3 py-2 transition hover:bg-gray-50"
                >
                  <p className="text-sm font-medium text-gray-900">{s.label}</p>
                  <p className="truncate text-xs text-gray-400">{s.url}</p>
                </a>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs font-medium text-gray-500">Add new source</p>
          <form onSubmit={handleSubmit}>
            <input
              type="url"
              required
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mb-2 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-gray-400"
            />
            <input
              type="text"
              placeholder="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mb-3 w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-gray-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving || !url.trim()}
                className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40"
              >
                {saving ? "Saving..." : "Add"}
              </button>
            </div>
          </form>
        </div>
      </div>
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
  const [events, setEvents] = useState<EventItem[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [officeHours, setOfficeHours] = useState<OfficeHourItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddSource, setShowAddSource] = useState(false);

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

  const { agentStates, runAgent, runningTabs, autoMode, setAutoMode } =
    useAgentRunner(loadData);

  const allItems: AnyItem[] = [
    ...homework.map((item) => ({ kind: "homework" as const, item })),
    ...events.map((item) => ({ kind: "event" as const, item })),
    ...officeHours.map((item) => ({ kind: "office_hour" as const, item })),
    ...exams.map((item) => ({ kind: "exam" as const, item })),
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
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
                <span
                  style={{
                    position: "absolute",
                    right: -2,
                    top: -2,
                    display: "flex",
                    width: 10,
                    height: 10,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "100%",
                      borderRadius: 9999,
                      backgroundColor: "#34d399",
                      opacity: 0.75,
                      animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
                    }}
                  />
                  <span
                    style={{
                      position: "relative",
                      display: "inline-flex",
                      width: 10,
                      height: 10,
                      borderRadius: 9999,
                      backgroundColor: "#10b981",
                    }}
                  />
                </span>
              )}
            </button>
          );
        })}
        <div className="mx-0.5 h-4 w-px shrink-0 bg-gray-300/60" />
        <button
          onClick={() => setShowAddSource(true)}
          className="shrink-0 rounded-md px-2 py-1.5 text-[12px] text-gray-400 transition hover:text-gray-600"
        >
          + source
        </button>
        <button
          onClick={() => setAutoMode((v) => !v)}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] transition"
          style={{
            fontWeight: autoMode ? 500 : 400,
            color: autoMode ? "#059669" : undefined,
          }}
        >
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              !autoMode ? "bg-gray-300" : ""
            }`}
            style={
              autoMode
                ? {
                    backgroundColor: "#10b981",
                    animation:
                      "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  }
                : undefined
            }
          />
          auto
        </button>
      </div>

      {showAddSource && (
        <AddSourceModal onClose={() => setShowAddSource(false)} />
      )}

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

"use client";

import { DndContext, DragEndEvent } from "@dnd-kit/core";
import { AllList } from "./components/AllList";
import type { AnyItem } from "./components/types";

// Mock data for demonstration
const mockItems: AnyItem[] = [
  {
    kind: "homework",
    item: {
      id: "hw-1",
      title: "Complete React Assignment",
      className: "Web Development",
      dueDate: "Feb 20, 2026",
      sourceUrl: "https://example.com/hw1",
      sourceName: "Canvas",
      source: "canvas",
    },
  },
  {
    kind: "event",
    item: {
      id: "ev-1",
      title: "Tech Talk: AI in Education",
      timeLabel: "Feb 18, 2026 3:00 PM",
      location: "Room 301",
      sourceUrl: "https://example.com/event1",
      source: "columbia-events",
    },
  },
  {
    kind: "office_hour",
    item: {
      id: "oh-1",
      label: "Prof. Smith - Computer Science",
      timeInfo: "Tuesdays 2-4 PM",
      location: "Office 205",
      sourceUrl: "https://example.com/oh1",
      source: "ext-sources",
    },
  },
  {
    kind: "exam",
    item: {
      id: "ex-1",
      title: "Midterm Exam - Data Structures",
      timeInfo: "Feb 25, 2026 10:00 AM",
      location: "Hall A",
      sourceUrl: "https://example.com/exam1",
      source: "ext-sources",
    },
  },
  {
    kind: "homework",
    item: {
      id: "hw-2",
      title: "Essay on Machine Learning",
      className: "CS 101",
      dueDate: "Feb 22, 2026",
      sourceUrl: "https://example.com/hw2",
      sourceName: "Canvas",
      source: "canvas",
    },
  },
  {
    kind: "event",
    item: {
      id: "ev-2",
      title: "Career Fair 2026",
      timeLabel: "Feb 19, 2026 9:00 AM",
      location: "Main Campus",
      sourceUrl: "https://example.com/event2",
      source: "columbia-events",
    },
  },
];

export default function ThirdPage() {
  function handleDragEnd(event: DragEndEvent) {
    console.log("Dragged item:", event.active.data.current);
  }

  return (
    <div className="h-screen overflow-hidden bg-white">
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-200 px-6 py-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            AllList Component Demo
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Unified infinite-scrolling list with drag-and-drop support
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <DndContext onDragEnd={handleDragEnd}>
            <AllList allItems={mockItems} />
          </DndContext>
        </div>
      </div>
    </div>
  );
}

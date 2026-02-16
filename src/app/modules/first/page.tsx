"use client";

import { DragToEditor } from "./components/DragToEditor";
import type { DraggableItemData } from "./components/types";

// Sample data for demonstration
const sampleItems: DraggableItemData[] = [
  {
    id: "1",
    type: "task",
    title: "Complete project proposal",
    subtitle: "Due tomorrow",
    metadata: {
      priority: "high",
      dueDate: "2024-02-17",
    },
  },
  {
    id: "2",
    type: "task",
    title: "Review pull requests",
    subtitle: "Engineering team",
    metadata: {
      priority: "medium",
      dueDate: "2024-02-18",
    },
  },
  {
    id: "3",
    type: "event",
    title: "Team standup meeting",
    subtitle: "10:00 AM · Conference Room A",
    metadata: {
      timeLabel: "10:00 AM",
      location: "Conference Room A",
    },
  },
  {
    id: "4",
    type: "event",
    title: "Product demo",
    subtitle: "2:00 PM · Virtual",
    metadata: {
      timeLabel: "2:00 PM",
      location: "Virtual",
    },
  },
  {
    id: "5",
    type: "note",
    title: "Research AI integration patterns",
    subtitle: "Technology research",
    metadata: {
      tags: ["ai", "research", "architecture"],
    },
  },
  {
    id: "6",
    type: "note",
    title: "Update documentation",
    subtitle: "API reference guide",
    metadata: {
      tags: ["docs", "api"],
    },
  },
  {
    id: "7",
    type: "task",
    title: "Fix login bug",
    subtitle: "Critical issue",
    metadata: {
      priority: "high",
      dueDate: "2024-02-16",
    },
  },
  {
    id: "8",
    type: "event",
    title: "Client presentation",
    subtitle: "4:00 PM · Client Office",
    metadata: {
      timeLabel: "4:00 PM",
      location: "Client Office",
    },
  },
];

const initialMarkdown = `# My Daily Briefing

## Welcome!

Drag items from the right panel into this editor to automatically generate contextual content using AI.

## Today's Focus

Start by dragging your tasks and events here to organize your day.

## Notes

`;

/**
 * Demo page for the DragToEditor component
 * Shows how to use the extracted drag-and-drop AI editor module
 */
export default function FirstPage() {
  return (
    <DragToEditor
      items={sampleItems}
      initialMarkdown={initialMarkdown}
      onMarkdownChange={(md) => {
        // Handle markdown changes (e.g., save to backend)
        console.log("Markdown updated:", md.slice(0, 100) + "...");
      }}
      dashboardTitle="My Items"
      theme="light"
    />
  );
}

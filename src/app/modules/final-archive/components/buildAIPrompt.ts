import type { DragItemData } from "./types";

export function buildAIPrompt(data: DragItemData): string {
  switch (data.type) {
    case "homework":
      return `Add a task item for "${data.item.title}"${data.item.className ? ` (${data.item.className})` : ""}, due ${data.item.dueDate}. Place it in the most relevant section of the briefing, or create a new section if needed.`;
    case "event":
      return `Add "${data.item.title}" to the schedule: ${data.item.timeLabel}${data.item.location ? ` at ${data.item.location}` : ""}. Place it in the most relevant section of the briefing.`;
    case "office_hour":
      return `Add office hours: ${data.item.label}, ${data.item.timeInfo}${data.item.location ? ` at ${data.item.location}` : ""}. Place it in the most relevant section of the briefing.`;
    case "exam":
      return `Add "${data.item.title}": ${data.item.timeInfo}${data.item.location ? ` in ${data.item.location}` : ""}. Place it in the most relevant section of the briefing, and add a reminder note if appropriate.`;
  }
}

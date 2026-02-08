import type { DragItemData } from "./types";

export function buildAIPrompt(data: DragItemData): string {
  switch (data.type) {
    case "assignment":
      return `Add a task item for "${data.item.title}" (${data.item.className}), due ${new Date(data.item.dueDate).toLocaleDateString()}. Place it in the most relevant section of the briefing, or create a new section if needed.`;
    case "event":
      return `Add "${data.item.title}" to the schedule: ${data.item.time} at ${data.item.location} on ${data.item.date}. Place it in the most relevant section of the briefing.`;
    case "office_hour":
      return `Add office hours for ${data.item.professor} (${data.item.course}): ${data.item.day} ${data.item.startTime}–${data.item.endTime} at ${data.item.location}. Place it in the most relevant section of the briefing.`;
    case "exam":
      return `Add "${data.item.title}" for ${data.item.course}: ${data.item.date} at ${data.item.time} in ${data.item.location}. Place it in the most relevant section of the briefing, and add a reminder note if appropriate.`;
  }
}
